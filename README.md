# redux-token-api-middleware

**Alpha software - currently under heavy development**

A redux middleware for making calls to APIs with token-based auth, automatically
requesting a new token if needed. Actions can be calls to single or multiple API
endpoints.

## Installation

	$ npm install redux-token-api-middleware

## Usage

### API actions

Actions that will be intercepted by the middleware are identified by the symbol
`CALL_TOKEN_API`, and follow the [Flux Standard Action](https://github.com/acdlite/flux-standard-action) pattern, however they must have a payload and have at least an `endpoint` in the payload.

#### Examples

```javascript

import { CALL_TOKEN_API } from 'redux-token-api-middleware'

export const BASIC_GET_ACTION = 'BASIC_GET_ACTION'
export const BASIC_POST_ACTION = 'BASIC_POST_ACTION'

// basic GET
// method defaults to GET if not provided
const basicGetAction = () => {
  [CALL_TOKEN_API]: {
    type: BASIC_GET_ACTION,
    payload: {
      endpoint: 'http://localhost/foo'
    }
  }
}

// basic POST
const basicPostAction = () => {
  [CALL_TOKEN_API]: {
    type: BASIC_POST_ACTION,
    payload: {
      endpoint: 'http://localhost/bar',
      method: 'POST'
    }
  }
}
```

### Setup

#### `main.js`

```javascript
import { createTokenApiMiddleware } from 'redux-token-api-middleware'
import { createStore, applyMiddleware } from 'redux'

import reducer from './reducers'

// example refresh token action
const refreshToken = (token) => {
  return {
    [CALL_TOKEN_API]: {
      type: 'REFRESH_TOKEN',
      endpoint: 'http://localhost/token',
      method: 'POST',
      body: JSON.stringify(token)
    }
  }
}

const config = {
  refreshAction: refreshToken
}

const apiTokenMiddleware = createTokenApiMiddleware(config)

const store = createStore(
  reducer,
  applyMiddleware(apiTokenMiddleware)
)
```

## API

#### `createTokenApiMiddleware(config)`

Creates a Redux middleware to handle API objects.

In the config, you must define at least a `refreshAction` method, which is used by the middleware to attempt to get a fresh token. This should be an API action itself.

Other methods can be passed in via config, but have defaults:

```javascript
// defaults shown
const config = {
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
    let tokenPayload = jwt.decode(token);
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