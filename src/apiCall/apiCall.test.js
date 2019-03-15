import identity from 'lodash.identity';
import { expect } from 'chai';
import { spy } from 'sinon';
import {
  Headers,
  Response,
} from 'cross-fetch';

import {
  createResponseHandlerWithMeta,
  responseToCompletion,
  preserveHeaderValues,
  resolveApiResponse,
  requestNewToken,
  apiRequestFromAction,
} from './apiCall';

const initialHeaders = { 'Content-Type': 'application/json' };
const getAllArgs = (fnSpy) => fnSpy.args;
const getArgs = (fnSpy) => getAllArgs(fnSpy)[0];
const getFirstArg = (fnSpy) => getArgs(fnSpy)[0];
const getReturnValue = (fnSpy) => fnSpy.returnValues[0];
const response = 'response';
const resolved = 'resolved';
const handled = 'handled';
const valid = 'valid';
const complete = 'complete';
const responseValidator = (apiResponse) => `${apiResponse} ${valid}`;
const onCompletion = (okResponse) => `${okResponse} ${complete}`;
const apiFetch = () => response;
const createResponseHandler = ({ responseHandler }) => responseHandler;
const handler = (resolvedResponse) => `${resolvedResponse} ${handled}`;
const responseResolver = (apiResponse) => `${apiResponse} ${resolved}`;
const START = 'START';
const COMPLETE = 'COMPLETE';

describe('createResponseHandlerWithMeta', () => {  
  const meta = {
    foo: 'bar',
  };
  const response = {
    bar: 'foo',
  };

  const tests = [
    {
      desc: 'no response handler provided, should use identity function',
      input: meta,
      expected: response,
    },
    {
      desc: 'response handler using meta, should pass the meta as second argument',
      input: { ...meta, responseHandler: (r, m) => ([r.bar, m.foo]) },
      expected: ['foo', 'bar'],
    },
    {
      desc: 'response handler not using meta, should not be affected by meta arg',
      input: { ...meta, responseHandler: r => r.bar },
      expected: 'foo',
    },
  ];

  tests.forEach((t) => {
    it(t.desc, () => {
      const {
        input,
        expected,
      } = t;

      // Act
      const responseHandler = createResponseHandlerWithMeta(input);

      // Assert
      expect(responseHandler(response)).deep.equal(expected);
    });
  });
});

describe('preserveHeaderValues', () => {
  const headers = {
      'x-page': '1',
      'x-per-page': '10',
      'x-total': '53',
    };

  const response = {
    headers: new Headers({
      ...initialHeaders,
      ...headers,
    }),
    body: '',
  };
  const tests = [
    {
      desc: 'should preserve header values into the meta action',
      input: { preserveHeaders: Object.keys(headers) },
      expected: { preservedHeaders: headers },
    },
    {
      desc: 'should return an empty object if meta.preserveHeaders is undefined',
      input: {},
      expected: {},
    },
    {
      desc: 'should return an empty object if meta.preserveHeaders is not an array',
      input: { preserveHeaders: headers },
      expected: {},
    },
    {
      desc: 'should return an empty object if meta.preserveHeaders is an empty array',
      input: { preserveHeaders: headers },
      expected: {},
    },
  ];

  tests.forEach((t) => {
    it(t.desc, () => {
      const {
        input,
        expected,
      } = t;

      // Act
      const actual = preserveHeaderValues(input, response);
      
      // Assert
      expect(actual).to.deep.equal(expected);
    });
  });
});

describe('responseToCompletion', () => {
  const responseJsonBody = { body: { key: 'value' } };
  const responseJson = new Response (
    JSON.stringify(responseJsonBody),
    { headers: new Headers(initialHeaders)},
  );
  
  const responseTextBody = 'Test Complete'; 
  const responseText = new Response (
    responseTextBody,
    { headers: new Headers({ 'Content-Type': 'text/html' })},
  );

  const tests = [
    {
      desc: 'Content-Type is application/json, should parse and return the response body',
      input: responseJson,
      expected: responseJsonBody,
    },
    {
      desc: 'Content-Type is text/html, should return the response body',
      input: responseText,
      expected: responseTextBody,
    },
  ];

  tests.forEach((t) => {
    it(t.desc, async () => {
      const {
        input,
        expected,
      } = t;

      // Act
      const actual = await responseToCompletion(input);

      // Assert
      expect(actual).to.deep.equal(expected);
    });
  });
});

const mapAsyncTests = (tests) => tests.forEach((t) => {
  it(t.desc, async () => {
    const {
      input: {
        call,
        params,
      },
      expected: {
        getResult,
        value,
        target,
      },
    } = t;

    // Act
    await call(...params);
    const result = await getResult(target);
    // Assert
    expect(result).to.deep.equal(value);
  });
});

describe('resolveApiResponse', () => {
  const responseValidatorSpy = spy(responseValidator);
  const onCompletionSpy = spy(onCompletion);
  const resolveApiResponseSpy = spy(resolveApiResponse);

  beforeEach(() => {
    responseValidatorSpy.resetHistory();
    onCompletionSpy.resetHistory();
    resolveApiResponseSpy.resetHistory();
  });
  
  const tests = [
    {
      desc: 'calls responseValidator with the response',
      input: {
        call: resolveApiResponse,
        params: [
          response,
          responseValidatorSpy,
          onCompletion,
        ],
      },
      expected: {
        getResult: getFirstArg,
        target: responseValidatorSpy,
        value: response,
      },
    },
    {
      desc: 'calls onCompletion with the value returned by responseValidator',
      input: {
        call: resolveApiResponse,
        params: [
          response,
          responseValidator,
          onCompletionSpy,
        ],
      },
      expected: {
        getResult: getFirstArg,
        target: onCompletionSpy,
        value: `${response} ${valid}`,
      },
    },
    {
      desc: 'returns the expected value',
      input: {
        call: resolveApiResponseSpy,
        params: [
          response,
          responseValidator,
          onCompletion,
        ],
      },
      expected: {
        getResult: getReturnValue,
        target: resolveApiResponseSpy,
        value: `${response} ${valid} ${complete}`,
      },
    },
  ];

  mapAsyncTests(tests);
});

describe('requestNewToken', () => {
  const refreshArgs = [ 'TEST', 'ARGS' ];
  const refreshActionMeta = {};

  const requestNewTokenSpy = spy(requestNewToken);
  const createResponseHandlerSpy = spy(createResponseHandler);
  const responseHandlerSpy = spy(handler);
  const responseResolverSpy = spy(responseResolver);
  const fetchSpy = spy(apiFetch);

  beforeEach(() => {
    requestNewTokenSpy.resetHistory();
    createResponseHandlerSpy.resetHistory();
    responseHandlerSpy.resetHistory();
    responseResolverSpy.resetHistory();
    fetchSpy.resetHistory();
    refreshActionMeta.responseHandler = handler;
  });
  
  const tests = [
    {
      desc: 'calls createResponseHandler with the refreshActionMeta',
      input: {
        call: requestNewToken,
        params: [
          refreshArgs,
          refreshActionMeta,
          responseValidator,
          apiFetch,
          responseResolver,
          createResponseHandlerSpy,
        ],
      },
      expected: {
        getResult: getFirstArg,
        target: createResponseHandlerSpy,
        value: refreshActionMeta,
      },
    },
    {
      desc: 'calls apiFetch with each item in refreshArgs as a parameter',
      input: {
        call: requestNewToken,
        params: [
          refreshArgs,
          refreshActionMeta,
          responseValidator,
          fetchSpy,
          responseResolver,
          createResponseHandlerSpy,
        ],
      },
      expected: {
        getResult: getArgs,
        target: fetchSpy,
        value: refreshArgs,
      },
    },
    {
      desc: 'calls responseResolver with the response returned by apiFetch, and the responseValidator',
      input: {
        call: requestNewToken,
        params: [
          refreshArgs,
          refreshActionMeta,
          responseValidator,
          apiFetch,
          responseResolverSpy,
          createResponseHandler,
        ],
      },
      expected: {
        getResult: getArgs,
        target: responseResolverSpy,
        value: [response, responseValidator],
      },
    },
    {
      desc: 'calls the response handler with the resolved response',
      input: {
        call: requestNewToken,
        params: [
          refreshArgs,
          { responseHandler: responseHandlerSpy },
          responseValidator,
          apiFetch,
          responseResolver,
          createResponseHandler,
        ],
      },
      expected: {
        getResult: getFirstArg,
        target: responseHandlerSpy,
        value: `${response} ${resolved}`,
      },
    },
    {
      desc: 'returns the expected value',
      input: {
        call: requestNewTokenSpy,
        params: [
          refreshArgs,
          refreshActionMeta,
          responseValidator,
          apiFetch,
          responseResolver,
          createResponseHandler,
        ],
      },
      expected: {
        getResult: getReturnValue,
        target: requestNewTokenSpy,
        value: `${response} ${resolved} ${handled}`,
      },
    },
  ];

  mapAsyncTests(tests);
});

describe('apiRequestFromAction', () => {
  const action = {
    type: 'TEST',
    payload: {
      bar: 'foo',
    },
    meta: {},
  };
  const actionWithPayloads = {
    ...action,
    payload: [1, 2, 3],
    meta: {
      responseHandler: identity,
      expectedReturn: [
        `${response} ${resolved}`,
        `${response} ${resolved}`,
        `${response} ${resolved}`,
      ],
    },
  };
  const token = '1234';
  const getFetchArgs = (action, token) => ([ action, token ]);
  const preserveHeaders = (meta, response) => ({ preservedHeaders: response.headers });
  const createStartAction = () => START;
  const createCompletionAction = () => COMPLETE;
  const dispatch = identity;

  const dispatchSpy = spy(dispatch);
  const apiRequestFromActionSpy = spy(apiRequestFromAction);
  const createResponseHandlerSpy = spy(createResponseHandler);
  const responseHandlerSpy = spy(handler);
  const responseResolverSpy = spy(responseResolver);
  const fetchSpy = spy(apiFetch);
  const preserveHeadersSpy = spy(preserveHeaders);
  const getFetchArgsSpy = spy(getFetchArgs);

  beforeEach(() => {
    apiRequestFromActionSpy.resetHistory();
    dispatchSpy.resetHistory();
    createResponseHandlerSpy.resetHistory();
    responseHandlerSpy.resetHistory();
    responseResolverSpy.resetHistory();
    preserveHeadersSpy.resetHistory();
    fetchSpy.resetHistory();
    getFetchArgsSpy.resetHistory(); 
    action.meta.responseHandler = handler;
  });
  
  const tests = [
    {
      desc: 'calls createResponseHandler with the action meta',
      input: {
        call: apiRequestFromAction,
        params: [
          action,
          dispatch,
          token,
          getFetchArgs,
          responseValidator,
          apiFetch,
          preserveHeaders,
          responseResolver,
          createResponseHandlerSpy,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: getFirstArg,
        target: createResponseHandlerSpy,
        value: action.meta,
      },
    },
    {
      desc: 'dispatches a start action',
      input: {
        call: apiRequestFromAction,
        params: [
          action,
          dispatchSpy,
          token,
          getFetchArgs,
          responseValidator,
          apiFetch,
          preserveHeaders,
          responseResolver,
          createResponseHandler,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: getArgs,
        target: dispatchSpy,
        value: [START],
      },
    },
    {
      desc: 'calls fetch with the fetchArgs',
      input: {
        call: apiRequestFromAction,
        params: [
          action,
          dispatch,
          token,
          getFetchArgs,
          responseValidator,
          fetchSpy,
          preserveHeaders,
          responseResolver,
          createResponseHandler,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: (fnSpy) => fnSpy.calledOnceWith(action, token),
        target: fetchSpy,
        value: true,
       },
      },
      {
        desc: 'calls responseResolver with the fetch response',
        input: {
          call: apiRequestFromAction,
          params: [
            actionWithPayloads,
            dispatch,
            token,
            getFetchArgs,
            responseValidator,
            apiFetch,
            preserveHeaders,
            responseResolverSpy,
            createResponseHandler,
            createStartAction,
            createCompletionAction,
          ],
        },
        expected: {
          getResult: getAllArgs,
          target: responseResolverSpy,
          value: [
            [response, responseValidator],
            [response, responseValidator],
            [response, responseValidator],
          ],
        },
      },
      {
        desc: 'should dispatch a completed action',
        input: {
          call: apiRequestFromAction,
          params: [
            actionWithPayloads,
            dispatchSpy,
            token,
            getFetchArgs,
            responseValidator,
            apiFetch,
            preserveHeaders,
            responseResolver,
            createResponseHandler,
            createStartAction,
            createCompletionAction,
          ],
        },
        expected: {
          getResult: (fnSpy) => fnSpy.secondCall.args,
          target: dispatchSpy,
          value: [COMPLETE],
        },
      },
      {
        desc: 'should return the handled responses',
        input: {
          call: apiRequestFromActionSpy,
          params: [
            action,
            dispatch,
            token,
            getFetchArgs,
            responseValidator,
            apiFetch,
            preserveHeaders,
            responseResolver,
            createResponseHandler,
            createStartAction,
            createCompletionAction,
          ],
        },
        expected: {
          getResult: getReturnValue,
          target: apiRequestFromActionSpy,
          value: `${response} ${resolved} ${handled}`,
        },
      },
      {
      desc: 'if payload is an array, calls fetch for each item in the payload array',
      input: {
        call: apiRequestFromAction,
        params: [
          actionWithPayloads,
          dispatch,
          token,
          getFetchArgs,
          responseValidator,
          fetchSpy,
          preserveHeaders,
          responseResolver,
          createResponseHandler,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: getAllArgs,
        target: fetchSpy,
        value: [
          [1, token],
          [2, token],
          [3, token],
        ],
      },
    },
    {
      desc: 'if payload is an array, calls responseResolver for each fetch response',
      input: {
        call: apiRequestFromAction,
        params: [
          actionWithPayloads,
          dispatch,
          token,
          getFetchArgs,
          responseValidator,
          apiFetch,
          preserveHeaders,
          responseResolverSpy,
          createResponseHandler,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: getAllArgs,
        target: responseResolverSpy,
        value: [
          [response, responseValidator],
          [response, responseValidator],
          [response, responseValidator],
        ],
      },
    },
    {
      desc: 'if payload is an array, should dispatch a single completed action',
      input: {
        call: apiRequestFromAction,
        params: [
          actionWithPayloads,
          dispatchSpy,
          token,
          getFetchArgs,
          responseValidator,
          apiFetch,
          preserveHeaders,
          responseResolver,
          createResponseHandler,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: (fnSpy) => fnSpy.secondCall.args,
        target: dispatchSpy,
        value: [COMPLETE],
      },
    },
    {
      desc: 'if payload is an array, should return the handled responses',
      input: {
        call: apiRequestFromActionSpy,
        params: [
          actionWithPayloads,
          dispatch,
          token,
          getFetchArgs,
          responseValidator,
          apiFetch,
          preserveHeaders,
          responseResolver,
          createResponseHandler,
          createStartAction,
          createCompletionAction,
        ],
      },
      expected: {
        getResult: getReturnValue,
        target: apiRequestFromActionSpy,
        value: actionWithPayloads.meta.expectedReturn,
      },
    },
  ];

  mapAsyncTests(tests);
});
