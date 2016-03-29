# redux-token-api-middleware

A redux middleware for making calls to APIs with token-based auth, automatically
requesting a new token if needed.

**Alpha software - currently under heavy development**

## Installation

	$ npm install redux-token-api-middleware
	
## Usage

#### `main.js`

```javascript
import { createTokenApiMiddleware } from 'redux-api-token-middleware'
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

```