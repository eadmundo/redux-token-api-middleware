import {expect} from 'chai';
import {ApiTokenMiddleware} from '../';
import jwt from 'jsonwebtoken';

describe('ApiTokenMiddleware', () => {

  let apiTokenMiddleware;
  let token;

  beforeEach(() => {
    token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
      expiresIn: '1 day'
    });
    apiTokenMiddleware = new ApiTokenMiddleware({}, {}, {
      refreshAction: token => {},
      // failureAction: token => {}
    });
  });

  describe('getApiFetchArgsFromActionPayload', () => {

    it('should something', () => {

      let fetchArgs = apiTokenMiddleware.getApiFetchArgsFromActionPayload({
        endpoint: 'http://localhost/something'
      });

      // console.log(fetchArgs);

    });

  });

  describe('apiCallMethod', () => {
    it('should be multipleApiCallsFromAction for multiple actions in a payload', () => {
      apiTokenMiddleware.apiAction = {
        payload: [
          { type: 'ACTION_1' }, { type: 'ACTION_2' }
        ]
      };
      expect(apiTokenMiddleware.apiCallMethod).to.eq(
        apiTokenMiddleware.multipleApiCallsFromAction
      );
    });

    it('should be apiCallFromAction for a single action payload', () => {
      apiTokenMiddleware.apiAction = {
        payload: {
          type: 'ACTION_1'
        }
      };
      expect(apiTokenMiddleware.apiCallMethod).to.eq(
        apiTokenMiddleware.apiCallFromAction
      );
    });
  });

  describe('default methods', () => {

    describe('checkTokenFreshness', () => {
      it('should be true if the difference between the token expiry & now is greater than the min token lifespan', () => {
        token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
          expiresIn: '1 hour'
        });
        let freshness = apiTokenMiddleware.checkTokenFreshness(token);
        expect(freshness).to.be.true;
      });

      it('should be false if the difference between the token expiry & now is less than the min token lifespan', () => {
        token = jwt.sign({ foo: 'bar' }, 'TOPSECRET', {
          expiresIn: '1 minute'
        });
        let freshness = apiTokenMiddleware.checkTokenFreshness(token);
        expect(freshness).to.be.false;
      });
    })

  });

});