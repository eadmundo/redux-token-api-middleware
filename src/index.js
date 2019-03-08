import startsWith from 'lodash.startswith';
import map from 'lodash.map';
import get from 'lodash.get';
import isUndefined from 'lodash.isundefined';
import isFunction from 'lodash.isfunction';
import isArrayLikeObject from 'lodash.isarraylikeobject';
import omitBy from 'lodash.omitby';
import curryRight from 'lodash.curryright';
import identity from 'lodash.identity';
import jwt_decode from 'jwt-decode';
import moment from 'moment';
import fetch from 'cross-fetch';

export const CALL_TOKEN_API = '@@CALL_TOKEN_API';
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

async function responseToCompletion(response) {
  const contentType = response.headers.get('Content-Type');
  if (contentType && startsWith(contentType, 'application/json')) {
    const text = await response.text()
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }
  return response.text();
}

const ASYNC_OPTIMIST_MAP = {
  START: 'BEGIN',
  COMPLETED: 'COMMIT',
  FAILED: 'REVERT',
};

export function createAsyncAction(type, step, payload, meta = {}) {
  let action = {
    type: `${type}_${step}`,
    payload: payload,
    meta: Object.assign(
      meta,
      { asyncStep: step },
    )
  };
  if (payload && payload instanceof Error) {
    Object.assign(action.meta, {
      error: true
    });
  }
  const { optimistId } = meta;
  if (optimistId !== undefined) {
    Object.assign(action, {
      optimist: {
        type: ASYNC_OPTIMIST_MAP[step],
        id: optimistId,
      }
    });
  }
  return action;
}

function createStartAction(type, payload, meta) {
  return createAsyncAction(type, 'START', payload, meta);
}

function createCompletionAction(type, payload, meta) {
  return createAsyncAction(type, 'COMPLETED', payload, meta);
}

function createFailureAction(type, error, meta) {
  return createAsyncAction(type, 'FAILED', new TypeError(error), meta);
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
  let tokenPayload = jwt_decode(token);
  let expiry = moment.unix(tokenPayload.exp);
  return expiry.diff(moment(), 'seconds') > MIN_TOKEN_LIFESPAN;
}

export function shouldRequestNewToken() {
  if (!this.refreshToken) {
    return false;
  }
  const token = retrieveToken();
  return token
    ? checkTokenFreshness(token)
    : false;
}

export function createResponseHandlerWithMeta(meta) {
  const baseHandler = meta.responseHandler || identity;
  const handlerToCurry = (response, meta) => (
    baseHandler(response, meta)
  );
  return curryRight(handlerToCurry)(meta);
}

export class TokenApiService {

  constructor(apiAction, dispatch, config={}) {
    this.apiAction = apiAction;
    this.meta = this.apiAction.meta || {};
    this.dispatch = dispatch;
    this.config = config;

    this.defaultHeaders = this.config.defaultHeaders || {
      'Content-Type': 'application/json'
    }
    this.retrieveRefreshToken = this.configOrDefault('retrieveRefreshToken')
    // config or default values
    this.checkTokenFreshness = this.configOrDefault('checkTokenFreshness');
    this.retrieveToken = this.configOrDefault('retrieveToken');
    this.storeToken = this.configOrDefault('storeToken');
    this.addTokenToRequest = this.configOrDefault('addTokenToRequest');
    this.refreshAction = this.configOrDefault('refreshAction');
    this.checkResponseIsOk = this.configOrDefault('checkResponseIsOk');
    this.tokenStorageKey = this.config.tokenStorageKey || TOKEN_STORAGE_KEY;
    this.minTokenLifespan = this.config.minTokenLifespan || MIN_TOKEN_LIFESPAN;
    this.actionKey = this.config.actionKey || CALL_TOKEN_API;
    this.preProcessRequest = this.config.preProcessRequest;
    this.refreshToken = this.config.refreshToken || false;
    this.shouldRequestNewToken = this.configOrDefault('shouldRequestNewToken');
    // bind where needed
    this.storeToken = this.storeToken.bind(this, this.tokenStorageKey);
    this.retrieveToken = this.retrieveToken.bind(this, this.tokenStorageKey);
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
      refreshAction: () => {},
      retrieveRefreshToken: () => {},
      shouldRequestNewToken,
      addTokenToRequest: this.defaultAddTokenToRequest,
      catchApiRequestError: this.defaultCatchApiRequestError,
      checkResponseIsOk: checkResponseIsOk
    }
  }

  completeApiRequest(type, finalResponse) {
    this.dispatch(createCompletionAction(
      type, finalResponse, this.meta,
    ));
    return finalResponse;
  }

  defaultCatchApiRequestError(type, error) {
    return error;
  }

  catchApiRequestError(type, error) {
    const fn = this.configOrDefault('catchApiRequestError');
    this.dispatch(createFailureAction(type, error, this.meta));
    return fn(type, error);
  }

  preserveHeaderValues(meta, response) {
    const headersToPreserve = meta.preserveHeaders;
    if (Array.isArray(headersToPreserve)) {
      const responseHeaders = response.headers;
      const preservedHeaders = headersToPreserve.reduce((headers, header) => {
        headers[header] = responseHeaders.get(header);
        return headers;
      }, {});
      meta.preservedHeaders = preservedHeaders;
    }
    return response;
  }

  apiRequest(fetchArgs, action) {
    const meta = action.meta || {};
    const completeApiRequest = this.completeApiRequest.bind(this, action.type);
    const catchApiRequestError = this.catchApiRequestError.bind(this, action.type);
    const preserveHeaderValues = this.preserveHeaderValues.bind(this, this.meta);
    return fetch.apply(this, fetchArgs)
      .then(this.checkResponseIsOk)
      .then(preserveHeaderValues)
      .then(responseToCompletion)
      .then(createResponseHandlerWithMeta(meta))
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
    const authenticate = get(this.meta, 'authenticate', true);
    const apiFetchArgs = this.getApiFetchArgsFromActionPayload(
      action.payload, token, authenticate,
    );
    this.dispatch(createStartAction(action.type, action.payload, this.meta));
    return this.apiRequest(apiFetchArgs, action, this.store);
  }

  multipleApiCallsFromAction(action, token=null) {
    const meta = action.meta || {};
    let promises = map(action.payload, (apiAction) => {
      const apiFetchArgs = this.getApiFetchArgsFromActionPayload(
        apiAction, token
      );
      return this.apiRequestPromise(apiFetchArgs)();
    });
    const completeApiRequest = this.completeApiRequest.bind(this, action.type);
    const catchApiRequestError = this.catchApiRequestError.bind(this, action.type);
    this.dispatch(createStartAction(action.type, action.payload, this.meta));
    return Promise.all(promises)
      .then(createResponseHandlerWithMeta(meta))
      .then(completeApiRequest)
      .catch(catchApiRequestError);
  }

  get apiCallMethod() {
    return isArrayLikeObject(this.apiAction.payload)
      ? this.multipleApiCallsFromAction
      : this.apiCallFromAction;
  }

  get curriedApiCallMethod() {
    return this.apiCallMethod.bind(this, this.apiAction);
  }

  async getToken() {
    const token = this.retrieveToken()
    if (token instanceof Promise) {
      return await token;
    }
    return token;
  }

  async getRefreshToken() {
    const token = this.retrieveRefreshToken()
    if (token instanceof Promise) {
      return await token;
    }
    return token;
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
    if (isUndefined(method)) {
      method = 'GET';
    }

    headers = Object.assign(this.defaultHeaders, headers);
    console.log('authenticate?', authenticate);
    if (token && authenticate) {
      (
        { headers, endpoint, body } = this.addTokenToRequest(
          headers, endpoint, body, token
        )
      );
    }
    if (isFunction(this.preProcessRequest)) {
      (
        { headers, endpoint, body } = this.preProcessRequest(
          headers, endpoint, body
        )
      )
    }

    return [
      endpoint, omitBy({method, body, credentials, headers}, isUndefined)
    ];
  }

  async call() {
    const token = await this.getToken();
    if (await this.shouldRequestNewToken()) {
      const refreshToken = await this.getRefreshToken();
      const refreshAction = this.refreshAction(refreshToken);
      const refreshApiAction = refreshAction[CALL_TOKEN_API];
      const refreshApiActionMeta = refreshApiAction.meta || {};
      const refreshArgs = this.getApiFetchArgsFromActionPayload(
        refreshApiAction.payload,
        token,
        refreshApiActionMeta.authenticate
      );

      return fetch.apply(null, refreshArgs)
        .then(this.checkResponseIsOk)
        .then(responseToCompletion)
        .then(createResponseHandlerWithMeta(refreshApiActionMeta))
        .then(this.curriedApiCallMethod)
        .catch(error => {
          this.dispatch(createFailureAction(this.apiAction.type, error, this.meta));
        });

    } else {
      return this.curriedApiCallMethod(token);
    }
  }
}

export function createApiAction(action) {
  return {
    [CALL_TOKEN_API]: action
  }
}

export function actionAsPromise(action, dispatch, config) {
  const actionKey = config.actionKey || CALL_TOKEN_API;
  const apiAction = action()[actionKey];
  if (apiAction) {
    const tokenApiService = new TokenApiService(apiAction, dispatch, config);
    return tokenApiService.call();
  } else {
    return Promise.reject('not an API action!')
  }
}

export function createTokenApiMiddleware(config={}) {

  return store => next => action => {

    let apiAction = action[config.actionKey]

    if (apiAction === undefined) {
      if (action[CALL_TOKEN_API] === undefined) {
        return next(action);
      }
      apiAction = action[CALL_TOKEN_API]
    }

    const tokenApiService = new TokenApiService(
      apiAction, store.dispatch, config
    );

    return tokenApiService.call();
  }
}
