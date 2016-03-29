import _ from 'lodash';
import jwt from 'jsonwebtoken';
import moment from 'moment-timezone';
import fetch from 'isomorphic-fetch';
import {createPromiseThunk} from 'redux-promise-thunk';

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

function responseAsJson(response) {
  const contentType = response.headers.get('Content-Type');
  if (contentType && _.startsWith(contentType, 'application/json')) {
    return response.json();
  }
  return response;
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

function createStartAction(type) {
  return createAsyncAction(type, 'START');
}

function createCompletionAction(type, payload) {
  return createAsyncAction(type, 'COMPLETED', payload);
}

function createFailureAction(type, error) {
  return createAsyncAction(type, 'FAILED', new TypeError(error));
}

export function storeToken(response) {
  let token = response.token;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  return token;
}

export class TokenApiMiddleware {

  constructor(apiAction, store, config={}) {
    this.apiAction = apiAction;
    this.meta = this.apiAction.meta || {};
    this.store = store;
    this.config = config;
    this.checkTokenFreshness = this.configOrDefault('checkTokenFreshness');
    this.retrieveToken = this.configOrDefault('retrieveToken');
    this.storeToken = this.configOrDefault('storeToken');
    this.addTokenToRequest = this.configOrDefault('addTokenToRequest');
    this.refreshAction = this.configOrNotImplemented('refreshAction');
    this.tokenStorageKey = this.config.tokenStorageKey || TOKEN_STORAGE_KEY;
    this.minTokenLifespan = this.config.minTokenLifespan || MIN_TOKEN_LIFESPAN;
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
      checkTokenFreshness: (token) => {
        let tokenPayload = jwt.decode(token);
        let expiry = moment.unix(tokenPayload.exp);
        return expiry.diff(moment.tz('UTC'), 'seconds') > this.minTokenLifespan;
      },
      retrieveToken: (key) => {
        let storedValue = localStorage.getItem(key);
        return storedValue
          ? JSON.parse(storedValue)
          : null;
      },
      storeToken,
      addTokenToRequest: (headers, token) => {
        return Object.assign({
          "Authentication": `Bearer ${token}`
        }, headers);
      }
    }
  }

  completeApiRequest(type, finalResponse) {
    this.store.dispatch(createCompletionAction(
      type, finalResponse
    ));
  }

  catchApiRequestError(type, error) {
    this.store.dispatch(createFailureAction(type, error));
  }

  apiRequest(fetchArgs, action) {
    const meta = action.meta || {};
    const store = this.store;
    const completeApiRequest = this.completeApiRequest.bind(this, action.type);
    const catchApiRequestError = this.catchApiRequestError.bind(this, action.type);
    return fetch.apply(this, fetchArgs)
      .then(checkResponseIsOk)
      .then(responseAsJson)
      .then(meta.responseHandler)
      .then(completeApiRequest)
      .catch(catchApiRequestError);
  }

  apiRequestPromise(fetchArgs) {
    return () => {
      return fetch.apply(null, fetchArgs)
        .then(checkResponseIsOk)
        .then(responseAsJson);
    };
  }

  apiCallFromAction(action, token=null) {
    const apiFetchArgs = this.getApiFetchArgsFromActionPayload(
      action.payload, token, this.meta.authenticate
    );
    this.store.dispatch(createStartAction(action.type));
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
    this.store.dispatch(createStartAction(action.type));
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
    return this.retrieveToken(TOKEN_STORAGE_KEY);
  }

  get shouldRequestNewToken() {
    return this.token
      ? this.checkTokenFreshness(this.token)
      : false;
  }

  getApiFetchArgsFromActionPayload(payload, token=null, authenticate=true) {
    let {headers, method} = payload;
    const {endpoint, body, credentials} = payload;
    if (_.isUndefined(method)) {
      method = 'GET';
    }
    headers = Object.assign({
      'Content-Type': 'application/json'
    }, headers);
    if (token && authenticate) {
      headers = this.addTokenToRequest(headers, token);
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
        .then(responseAsJson)
        .then(this.storeToken)
        .then(token => {
          this.curriedApiCallMethod(token);
        })
        .catch(error => {
          this.store.dispatch(createFailureAction(this.apiAction.type, error));
        });
    } else {
      this.curriedApiCallMethod(this.token);
    }
  }

}

export function createTokenApiMiddleware(config={}) {

  return store => next => action => {

    const apiAction = action[CALL_TOKEN_API];

    if (apiAction === undefined) {
      return next(action);
    }

    const tokenApiMiddleware = new TokenApiMiddleware(
      apiAction, store, config
    );

    tokenApiMiddleware.call();

  }

}