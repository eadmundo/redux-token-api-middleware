/*eslint-disable no-unused-vars*/
import "babel-polyfill";

import React from 'react';
import ReactDOM from 'react-dom';
import {
  createStore,
  applyMiddleware
} from 'redux';
import {
  createTokenApiMiddleware
} from 'redux-token-api-middleware';

const reducer = (state, action) => {
  return state;
};

const store = createStore(
  reducer
);

class App extends React.Component {
  render() {
    return (
      <div>Basic Login Example</div>
    );
  }
}

function render() {
  ReactDOM.render(
    <App />,
    document.getElementById('root')
  )
}

render()
store.subscribe(render)
