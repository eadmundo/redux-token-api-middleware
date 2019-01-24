import { expect } from 'chai';
import sinon from 'sinon'
import jwt from 'jsonwebtoken';

import { TokenApiService, createResponseHandlerWithMeta } from '../src';

describe('createResponseHandlerWithMeta', () => {

  let meta;
  let response;

  beforeEach(() => {
    meta = {
      foo: 'bar'
    };
    response = {
      bar: 'foo'
    };
  });

  context('no response handler provided', () => {
    it('should just use identity function', () => {
      const curried = createResponseHandlerWithMeta(meta);
      const handledResponse = curried(response);
      expect(handledResponse).to.eql({
        bar: 'foo',
      });
    });
  });

  context('response handler using meta', () => {
    it('should pass the meta as second argument', () => {
      meta.responseHandler = (r, m) => ([r.bar, m.foo]);
      const curried = createResponseHandlerWithMeta(meta);
      const handledResponse = curried(response);
      expect(handledResponse).to.eql(['foo', 'bar']);
    });
  });

  context('response handler not using meta', () => {
    it('should not be affected by meta arg', () => {
      meta.responseHandler = r => r.bar;
      const curried = createResponseHandlerWithMeta(meta);
      const handledResponse = curried(response);
      expect(handledResponse).to.eq('foo');
    });
  });
});

describe('TokenApiService', () => {

  let tokenApiService;
  let token;
  let headers;

  beforeEach(() => {
    token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
      expiresIn: '1 day'
    });
    tokenApiService = new TokenApiService({}, {}, {
      refreshAction: token => {},
      // failureAction: token => {}
    });
    headers = {
      'x-page': 1,
      'x-per-page': 10,
      'x-total': 53
    };
  });

  // describe('getApiFetchArgsFromActionPayload', () => {

  //   it('should something', () => {

  //     let fetchArgs = tokenApiService.getApiFetchArgsFromActionPayload({
  //       endpoint: 'http://localhost/something',
  //     }, token);

  //     // console.log(fetchArgs);

  //   });

  // });

  describe('preserveHeaderValues', () => {
    it('should preserve header values into the meta action', () => {
      const meta = {
        preserveHeaders: Object.keys(headers),
      };
      // tokenApiService.meta =
      // tokenApiService.preserveHeaderValues({headers}, meta);
      tokenApiService.preserveHeaderValues({headers}, meta);
    });
  });

  describe('apiCallMethod', () => {
    it('should be multipleApiCallsFromAction for multiple actions in a payload', () => {
      tokenApiService.apiAction = {
        payload: [
          { type: 'ACTION_1' }, { type: 'ACTION_2' }
        ]
      };
      expect(tokenApiService.apiCallMethod).to.eq(
        tokenApiService.multipleApiCallsFromAction
      );
    });

    it('should be apiCallFromAction for a single action payload', () => {
      tokenApiService.apiAction = {
        payload: {
          type: 'ACTION_1'
        }
      };
      expect(tokenApiService.apiCallMethod).to.eq(
        tokenApiService.apiCallFromAction
      );
    });
  });

  describe('default methods', () => {

    describe('checkTokenFreshness', () => {
      it('should be true if the difference between the token expiry & now is greater than the min token lifespan', () => {
        token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
          expiresIn: '1 hour'
        });
        let freshness = tokenApiService.checkTokenFreshness(token);
        expect(freshness).to.be.true;
      });

      it('should be false if the difference between the token expiry & now is less than the min token lifespan', () => {
        token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
          expiresIn: '1 minute'
        });
        let freshness = tokenApiService.checkTokenFreshness(token);
        expect(freshness).to.be.false;
      });
    })

  });

});
