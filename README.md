# redux-token-api-middleware

A redux middleware for making calls to APIs with token-based auth, automatically
requesting a new token if needed. Actions can be calls to single or multiple API
endpoints.

## Installation

	$ npm install redux-token-api-middleware

## Usage

### API actions

Actions that will be intercepted by the middleware are identified by the symbol
`CALL_TOKEN_API`, and follow the [Flux Standard Action](https://github.com/acdlite/flux-standard-action) pattern, however they must have a payload and have at least an `endpoint` in the payload.

#### `action.meta`:
  - `preserveHeaders`: an array of headers to be preserved in the `meta.preservedHeaders` field of the completed action,
  - `optimistId`: a unique ID that will activate [redux-optimist](https://github.com/ForbesLindesay/redux-optimist) compatibility.

#### Examples

```javascript

import {
  CALL_TOKEN_API,
  createApiAction,
} from 'redux-token-api-middleware';

export const BASIC_GET_ACTION = 'BASIC_GET_ACTION';
export const BASIC_POST_ACTION = 'BASIC_POST_ACTION';

// basic GET
// method defaults to GET if not provided
const basicGetAction = () => ({
  [CALL_TOKEN_API]: {
    type: BASIC_GET_ACTION,
    payload: {
      endpoint: 'http://localhost/foo',
    },
  },
});

// basic POST
const basicPostAction = () => ({
  [CALL_TOKEN_API]: {
    type: BASIC_POST_ACTION,
    payload: {
      endpoint: 'http://localhost/bar',
      method: 'POST',
    },
  },
});

// basic POST using createApiAction and meta.
// createApiAction will wrap the provided action in a token api action.
const postApiAction = (body) => createApiAction({
  type: BASIC_POST_ACTION,
  payload: {
    endpoint: 'http://localhost/bar',
    method: 'POST',
    body,
    meta: {
      preserveHeaders: [
      // These headers will be taken from the API response and placed in meta.preservedHeaders.
        'x-page', 
        'x-per-page',
        'x-total',
      ],
      optimistId: 'token-optimist',
    },
  },
});

```

### Setup

#### `main.js`

```javascript
import { createTokenApiMiddleware } from 'redux-token-api-middleware';
import {
  createStore,
  applyMiddleware,
} from 'redux';

import reducer from './reducers';

// example refresh token action
const refreshAction = (token) => ({
  [CALL_TOKEN_API]: {
    type: 'REFRESH_TOKEN',
    endpoint: 'http://localhost/token',
    method: 'POST',
    body: JSON.stringify(token),
  },
});

// You will need to provide a `retrieveRefreshToken` method to the config that will
// return the refresh token that is used to obtain a new access token.

const retrieveRefreshToken = (key = 'RefreshTokenStorageKey') => {
  // This return value is passed to `refreshAction`
  return localStorage.getItem(key);
};

const config = {
  refreshAction,
  retrieveRefreshToken,
};

const apiTokenMiddleware = createTokenApiMiddleware(config);

const store = createStore(
  reducer,
  applyMiddleware(apiTokenMiddleware),
);

```

## API

#### `createTokenApiMiddleware(config)`

Creates a Redux middleware to handle API objects.

In the config, you must define at least a `refreshAction` method and a `retrieveRefreshToken`
method, which is used by the middleware to attempt to get a fresh token. This should be an API
action itself.

Other methods can be passed in via config, but have defaults:


##### Config Options

| Option                |                                      Type                                       | Description                                                                             |
| --------------------- | :-----------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------- |
| defaultHeaders        |                                    `Object`                                     | The headers to apply to each request.                                                   |
| retrieveRefreshToken  |                                   `Function`                                    | Retrieves the refresh token.                                                            |
| tokenStorageKey       |                                    `string`                                     | The key that the token will be stored under.                                            |
| checkTokenFreshness   |                               `(token)=>boolean`                                | Used by the default `shouldRequestNewToken`. Return `true` to trigger a token refresh.  |
| retrieveToken         |                                 `(key)=>?token`                                 | Retrieves the token.                                                                    |
| storeToken            |                             `(key,response)=>token`                             | Replaces the default class method.                                                      |
| refreshAction         |          `(refreshToken)=>({[actionKey]:{payload:any,meta?:Object}})`           | API action fired when refreshing the token.            |
| shouldRequestNewToken |                                  `()=>boolean`                                  | Determines when to refresh token. (`checkTokenFreshness` will not be used if provided.) |
| addTokenToRequest     | `(headers,endpoint,body,token)=>({headers:Object,endpoint:string,body:Object})` | Adds token to the request.                                                              |
| catchApiRequestError  |                              `(type,error)=>void`                               | Additional error handler to be fired after `FAILED` action is dispatched.               |
| checkResponseIsOk     |                                `(response)=>any`                                | Checks and returns an `ok` response.                                                    |
| minTokenLifespan      |                                    `number`                                     | Time in seconds until a new token should be requested.                                  |
| actionKey             |                                    `string`                                     | The action key the middleware will intercept.                                           |
| preProcessRequest     |    `(headers,endpoint,body)=>({headers:Object,endpoint:string,body:Object})`    | Additional request handler.                                                             |

```javascript
// defaults shown
const config = {
  actionKey: '@@CALL_TOKEN_API',
  defaultHeaders: { 'Content-Type': 'application/json' },
  retrieveRefreshToken: () => {}; // To be implemented by the user for refreshing tokens.
  tokenStorageKey: 'reduxMiddlewareAuthToken',
  minTokenLifespan: 300, // seconds (min remaining lifespan to indicate new token should be requested)
  storeToken: function storeToken(key, response) {
    let token = response.token;
    localStorage.setItem(key, JSON.stringify(token));
    return token;
  },
  retrieveToken: function retrieveToken(key) {
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
  },
  checkTokenFreshness: function checkTokenFreshness(token) {
    let tokenPayload = jwt_decode(token);
    let expiry = moment.unix(tokenPayload.exp);
    return expiry.diff(moment(), 'seconds') > MIN_TOKEN_LIFESPAN;
  },
  shouldRequestNewToken: function shouldRequestNewToken() {
    const token = retrieveToken();
    return token
      ? checkTokenFreshness(token)
      : false;
  },
  addTokenToRequest: function defaultAddTokenToRequest(headers, endpoint, body, token) {
    return {
      headers: Object.assign({
        Authorization: `JWT ${token}`
      }, headers),
      endpoint,
      body
    }
  }
}
```

_Note_: `retrieveRefreshToken`, `storeToken` and `retrieveToken` methods may also return
promises that the middleware will resolve.
