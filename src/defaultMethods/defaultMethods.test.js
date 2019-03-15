import { expect } from 'chai';

import jwt from 'jsonwebtoken';

import {
  // defaultAddtokenToRequest,
  // defaultApiRequestErrorHandler,
  // defaultCheckResponseIsOk,
  defaultCheckTokenFreshness,
  // defaultRetrieveToken,
  // defaultShouldRequestNewToken,
} from './defaultMethods';
import { MIN_TOKEN_LIFESPAN } from '../constants';

describe('checkTokenFreshness', () => {
  let token;

  beforeEach(() => {
    token = jwt.sign(
      { foo: 'bar' },
      'TOPSECRET',
      { expiresIn: '1 day'},
    );
  });

  it('should be true if the difference between the token expiry & now is greater than the min token lifespan', () => {
    token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
      expiresIn: '1 hour',
    });
    const freshness = defaultCheckTokenFreshness(token, MIN_TOKEN_LIFESPAN);
    expect(freshness).to.be.true;
  });

  it('should be false if the difference between the token expiry & now is less than the min token lifespan', () => {
    token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
      expiresIn: '1 minute',
    });
    const freshness = defaultCheckTokenFreshness(token, MIN_TOKEN_LIFESPAN);
    expect(freshness).to.be.false;
  });
});
