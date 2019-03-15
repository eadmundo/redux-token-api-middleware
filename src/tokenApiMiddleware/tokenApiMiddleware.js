import get from 'lodash.get';

import { CALL_TOKEN_API } from '../constants';
import { createCallTokenApiService } from '../callTokenApiService';

export const createTokenApiMiddleware = (config = {}) => {
  const callTokenApiService = createCallTokenApiService(config);

  return ({ dispatch }) => next => (action) => {

    const actionKey = get(config, 'actionKey', CALL_TOKEN_API);
    const apiAction = action[actionKey];

    if ( apiAction === undefined) {
        return next(action);
    }

    return callTokenApiService(apiAction, dispatch);
  };
};

export const createApiAction = (action) => {
  return {
    [CALL_TOKEN_API]: action,
  };
};
