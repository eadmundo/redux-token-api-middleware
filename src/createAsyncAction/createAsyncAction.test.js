import { expect } from 'chai';

import { createAsyncAction } from './createAsyncAction';

describe('createAsyncAction', () => {
  const type = 'OPTIMISTIC_ACTION';
  const optimistId = '123456';
  const meta = { optimistId };
  const payload = { foo: 'bar' };

  const tests = [
    {
      desc: 'should add BEGIN for async START',
      input: 'START',
      expected: {
        type: 'OPTIMISTIC_ACTION_START',
        payload,
        meta: {
          ...meta,
          asyncStep: 'START',
        },
        optimist: {
          type: 'BEGIN',
          id: optimistId,
        },
      },
    },
    {
      desc: 'should add COMMIT for async COMPLETED',
      input: 'COMPLETED',
      expected: {
        type: 'OPTIMISTIC_ACTION_COMPLETED',
        payload,
        meta: {
          ...meta,
          asyncStep: 'COMPLETED',
        },
        optimist: {
          type: 'COMMIT',
          id: optimistId,
        },
      },
    },
    {
      desc: 'should add REVERT for async FAILED',
      input: 'FAILED',
      expected: {
        type: 'OPTIMISTIC_ACTION_FAILED',
        payload,
        meta: {
          ...meta,
          asyncStep: 'FAILED',
        },
        optimist: {
          type: 'REVERT',
          id: optimistId,
        },
      },
    },
  ];

  tests.forEach((t) => {
    it(t.desc, () => {
      const {
        input,
        expected,
      } = t;

      // Act
      const actual = createAsyncAction(type, input, payload, meta);

      // Assert
      expect(actual).deep.equal(expected);
    });
  });
});
