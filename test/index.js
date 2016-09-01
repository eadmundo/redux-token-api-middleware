import { expect } from 'chai';
import { TokenApiMiddleware } from '../';
import jwt from 'jsonwebtoken';

describe('TokenApiMiddleware', () => {

  let tokenApiMiddleware;
  let token;

  beforeEach(() => {
    token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
      expiresIn: '1 day'
    });
    tokenApiMiddleware = new TokenApiMiddleware({}, {}, {
      refreshAction: token => {},
      // failureAction: token => {}
    });
  });

  describe('getApiFetchArgsFromActionPayload', () => {

    it('should something', () => {

      let fetchArgs = tokenApiMiddleware.getApiFetchArgsFromActionPayload({
        endpoint: 'http://localhost/something',
      }, token);

      console.log(fetchArgs);

    });

  });

  describe('apiCallMethod', () => {
    it('should be multipleApiCallsFromAction for multiple actions in a payload', () => {
      tokenApiMiddleware.apiAction = {
        payload: [
          { type: 'ACTION_1' }, { type: 'ACTION_2' }
        ]
      };
      expect(tokenApiMiddleware.apiCallMethod).to.eq(
        tokenApiMiddleware.multipleApiCallsFromAction
      );
    });

    it('should be apiCallFromAction for a single action payload', () => {
      tokenApiMiddleware.apiAction = {
        payload: {
          type: 'ACTION_1'
        }
      };
      expect(tokenApiMiddleware.apiCallMethod).to.eq(
        tokenApiMiddleware.apiCallFromAction
      );
    });
  });

  describe('default methods', () => {

    describe('checkTokenFreshness', () => {
      it('should be true if the difference between the token expiry & now is greater than the min token lifespan', () => {
        token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
          expiresIn: '1 hour'
        });
        let freshness = tokenApiMiddleware.checkTokenFreshness(token);
        expect(freshness).to.be.true;
      });

      it('should be false if the difference between the token expiry & now is less than the min token lifespan', () => {
        token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
          expiresIn: '1 minute'
        });
        let freshness = tokenApiMiddleware.checkTokenFreshness(token);
        expect(freshness).to.be.false;
      });
    })

  });

});