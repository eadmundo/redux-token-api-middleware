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
`CALL_TOKEN_API`, and follow the [Flux Standard Action]() pattern. They must have
at least an `endpoint` in the payload.

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

const config = {
  refreshAction: refreshToken
}

const apiTokenMiddleware = createTokenApiMiddleware(config)

const store = createStore(
  reducer,
  applyMiddleware(apiTokenMiddleware)
)

## API

#### `createTokenApiMiddleware(config)`

Creates a Redux middleware 

```