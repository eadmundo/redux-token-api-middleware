import { expect } from 'chai';
import { TokenApiService } from '../';
import jwt from 'jsonwebtoken';

describe('TokenApiService', () => {

  let tokenApiService;
  let token;

  beforeEach(() => {
    token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
      expiresIn: '1 day'
    });
    tokenApiService = new TokenApiService({}, {}, {
      refreshAction: token => {},
      // failureAction: token => {}
    });
  });

  describe('getApiFetchArgsFromActionPayload', () => {

    it('should something', () => {

      let fetchArgs = tokenApiService.getApiFetchArgsFromActionPayload({
        endpoint: 'http://localhost/something',
      }, token);

      console.log(fetchArgs);

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