import _ from 'lodash';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import fetch from 'isomorphic-fetch';

export const CALL_TOKEN_API = Symbol('Call API');
export const TOKEN_STORAGE_KEY = 'reduxMiddlewareAuthToken';

const MIN_TOKEN_LIFESPAN = 300;

const NotImplemented = function(message) {
  this.name = 'NotImplemented';
  this.message = message || 'Method not implemented';
  this.stack = (new Error()).stack;
}
NotImplemented.prototype = Object.create(Error.prototype);
NotImplemented.prototype.constructor = NotImplemented;

function checkResponseIsOk(response) {
  return response.ok ? response : response.text().then(text => {
    return Promise.reject(text);
  });
}

function responseToCompletion(response) {
  const contentType = response.headers.get('Content-Type');
  if (contentType && _.startsWith(contentType, 'application/json')) {
    return response.json();
  }
  return response.text();
}

function createAsyncAction(type, step, payload) {
  let action = {
    type: `${type}_${step}`,
    payload: payload,
    meta: {
      asyncStep: step
    }
  };
  if (payload && payload instanceof Error) {
    Object.assign(action.meta, {
      error: true
    });
  }
  return action;
}

function createStartAction(type, payload) {
  return createAsyncAction(type, 'START', payload);
}

function createCompletionAction(type, payload) {
  return createAsyncAction(type, 'COMPLETED', payload);
}

function createFailureAction(type, error) {
  return createAsyncAction(type, 'FAILED', new TypeError(error));
}

export function storeToken(key, response) {
  let token = response.token;
  localStorage.setItem(key, JSON.stringify(token));
  return token;
}

export function retrieveToken(key) {
  let storedValue = localStorage.getItem(key);
  if (!storedValue) {
    return null;
  }
  try {
    return JSON.parse(storedValue);
  }
  catch (e) {
    if (e instanceof SyntaxError) {
      return null;
    }
    throw e;
  }
}

export function removeToken(key) {
  localStorage.removeItem(key);
}

export function checkTokenFreshness(token) {
  let tokenPayload = jwt.decode(token);
  let expiry = moment.unix(tokenPayload.exp);
  return expiry.diff(moment(), 'seconds') > MIN_TOKEN_LIFESPAN;
}

export function shouldRequestNewToken() {
  const token = retrieveToken();
  return token
    ? checkTokenFreshness(token)
    : false;
}

export class TokenApiService {

  constructor(apiAction, dispatch, config={}) {
    this.apiAction = apiAction;
    this.meta = this.apiAction.meta || {};
    console.log('dispatch', dispatch)
    this.dispatch = dispatch;
    this.config = config;
    // config or default values
    this.checkTokenFreshness = this.configOrDefault('checkTokenFreshness');
    this.retrieveToken = this.configOrDefault('retrieveToken');
    this.shouldRequestNewToken = this.configOrDefault('shouldRequestNewToken');
    this.storeToken = this.configOrDefault('storeToken');
    this.addTokenToRequest = this.configOrDefault('addTokenToRequest');
    this.refreshAction = this.configOrNotImplemented('refreshAction');
    this.tokenStorageKey = this.config.tokenStorageKey || TOKEN_STORAGE_KEY;
    this.minTokenLifespan = this.config.minTokenLifespan || MIN_TOKEN_LIFESPAN;

    // bind where needed
    this.storeToken = this.storeToken.bind(this, this.tokenStorageKey);
    this.retrieveToken = this.retrieveToken.bind(this, this.tokenStorageKey);
    // this.failureAction = this.configOrNotImplemented('failureAction');
  }

  configOrDefault(key) {
    return this.config[key] || this.defaultMethods[key];
  }

  configOrNotImplemented(key) {
    const method = this.config[key];
    if (!method) {
      throw new NotImplemented(`Please provide ${key} in config`);
    }
    return method;
  }

  get defaultMethods() {
    return {
      checkTokenFreshness,
      retrieveToken,
      storeToken,
      addTokenToRequest: this.defaultAddTokenToRequest
    }
  }

  completeApiRequest(type, finalResponse) {
    this.dispatch(createCompletionAction(
      type, finalResponse
    ));
  }

  catchApiRequestError(type, error) {
    this.dispatch(createFailureAction(type, error));
  }

  apiRequest(fetchArgs, action) {
    const meta = action.meta || {};
    const completeApiRequest = this.completeApiRequest.bind(this, action.type);
    const catchApiRequestError = this.catchApiRequestError.bind(this, action.type);
    return fetch.apply(this, fetchArgs)
      .then(checkResponseIsOk)
      .then(responseToCompletion)
      .then(meta.responseHandler)
      .then(completeApiRequest)
      .catch(catchApiRequestError);
  }

  apiRequestPromise(fetchArgs) {
    return () => {
      return fetch.apply(null, fetchArgs)
        .then(checkResponseIsOk)
        .then(responseToCompletion);
    };
  }

  apiCallFromAction(action, token=null) {
    console.log(action, token);
    const apiFetchArgs = this.getApiFetchArgsFromActionPayload(
      action.payload, token
    );
    console.log('apiFetchArgs');
    console.log(apiFetchArgs);
    console.log(this);
    this.dispatch(createStartAction(action.type, action.payload));
    this.apiRequest(apiFetchArgs, action, this.store);
  }

  multipleApiCallsFromAction(action, token=null) {
    const meta = action.meta || {};
    let promises = _.map(action.payload, (apiAction) => {
      const apiFetchArgs = this.getApiFetchArgsFromActionPayload(
        apiAction, token
      );
      return this.apiRequestPromise(apiFetchArgs)();
    });
    const completeApiRequest = this.completeApiRequest.bind(this, action.type);
    const catchApiRequestError = this.catchApiRequestError.bind(this, action.type);
    this.dispatch(createStartAction(action.type, action.payload));
    Promise.all(promises)
      .then(meta.responseHandler)
      .then(completeApiRequest)
      .catch(catchApiRequestError);
  }

  get apiCallMethod() {
    return _.isArrayLikeObject(this.apiAction.payload)
      ? this.multipleApiCallsFromAction
      : this.apiCallFromAction;
  }

  get curriedApiCallMethod() {
    return this.apiCallMethod.bind(this, this.apiAction);
  }

  get token() {
    return this.retrieveToken();
  }

  defaultAddTokenToRequest(headers, endpoint, body, token) {
    return {
      headers: Object.assign({
        Authorization: `JWT ${token}`
      }, headers),
      endpoint,
      body
    }
  }

  getApiFetchArgsFromActionPayload(payload, token=null, authenticate=true) {
    let { headers, endpoint, method, body, credentials } = payload;
    if (_.isUndefined(method)) {
      method = 'GET';
    }
    headers = Object.assign({
      'Content-Type': 'application/json'
    }, headers);
    if (token && authenticate) {
      console.log('token & authenticate');
      (
        { headers, endpoint, body } = this.addTokenToRequest(
          headers, endpoint, body, token
        )
      );
    }
    return [
      endpoint, _.omitBy({method, body, credentials, headers}, _.isUndefined)
    ];
  }

  call() {
    if (this.shouldRequestNewToken) {
      const refreshAction = this.refreshAction(this.token);
      const refreshApiAction = refreshAction[CALL_TOKEN_API];
      const refreshApiActionMeta = refreshApiAction.meta || {};
      const refreshArgs = this.getApiFetchArgsFromActionPayload(
        refreshApiAction.payload,
        this.token,
        refreshApiActionMeta.authenticate
      );
      fetch.apply(null, refreshArgs)
        .then(checkResponseIsOk)
        .then(responseToCompletion)
        .then(this.storeToken)
        .then(token => {
          this.curriedApiCallMethod(token);
        })
        .catch(error => {
          this.dispatch(createFailureAction(this.apiAction.type, error));
        });
    } else {
      console.log('no refresh');
      console.log(this.token);
      this.curriedApiCallMethod(this.token);
    }
  }

}

export function actionAsPromise(action, dispatch, config) {
  console.log('actionAsPromise', dispatch)
  const apiAction = action()[CALL_TOKEN_API];
  if (apiAction) {
    const tokenApiService = new TokenApiService(apiAction, dispatch, config);
    return tokenApiService.call();
  }
}

export function createTokenApiMiddleware(config={}) {

  console.log('createTokenApiMiddleware');

  return store => next => action => {

    const apiAction = action[CALL_TOKEN_API];

    if (apiAction === undefined) {
      return next(action);
    }

    console.log(apiAction.type);

    const tokenApiService = new TokenApiService(
      apiAction, store.dispatch, config
    );

    tokenApiService.call();

  }

}