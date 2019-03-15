import get from 'lodash.get';

import {
  CALL_TOKEN_API,
  defaultHeaders as contentTypeHeaders,
  MIN_TOKEN_LIFESPAN,
  TOKEN_STORAGE_KEY,
} from '../constants';
import {
  apiRequestFromAction,
  requestNewToken,
} from '../apiCall';
import { createFailureAction } from '../createAsyncAction';
import { getApiFetchArgsFromActionPayload } from '../getFetchArgs';
import {
  defaultCheckResponseIsOk,
  defaultApiRequestErrorHandler,
  defaultShouldRequestNewToken,
  defaultAddtokenToRequest,
  defaultRetrieveToken,
  defaultCheckTokenFreshness,
} from '../defaultMethods';

const createGetToken = (getToken) => async () => {
  const token = getToken();
  if (token instanceof Promise) {
    return await token;
  }
  return token;
};

export const createCallTokenApiService = (
  {
    defaultHeaders = contentTypeHeaders,
    retrieveRefreshToken = () => {},
    tokenStorageKey = TOKEN_STORAGE_KEY,
    checkTokenFreshness = defaultCheckTokenFreshness,
    retrieveToken = defaultRetrieveToken,
    // storeToken,
    refreshAction = () => {},
    refreshToken = false,
    shouldRequestNewToken = defaultShouldRequestNewToken,
    addTokenToRequest =  defaultAddtokenToRequest,
    catchApiRequestError = defaultApiRequestErrorHandler,
    checkResponseIsOk = defaultCheckResponseIsOk,
    minTokenLifespan = MIN_TOKEN_LIFESPAN,
    actionKey = CALL_TOKEN_API,
    preProcessRequest,
  },
  getToken = createGetToken,
  getApiFetchArgs = getApiFetchArgsFromActionPayload,
  apiCallMethod = apiRequestFromAction,
  fetchNewToken = requestNewToken,
) => async (action, dispatch) => {
  const token = await getToken(retrieveToken(tokenStorageKey));
  const getFetchArgs = (
    payload,
    apiToken = token,
    authenticate = action.meta.authenticate,
    ) => getApiFetchArgs(
    payload,
    apiToken,
    authenticate,
    defaultHeaders,
    addTokenToRequest,
    preProcessRequest,
  );

  const newTokenRequired = await shouldRequestNewToken(
    refreshToken,
    checkTokenFreshness,
    retrieveToken,
    tokenStorageKey,
    minTokenLifespan,
  );

  if (newTokenRequired) {
    const refreshToken = await getToken(retrieveRefreshToken);
    const refreshedAction = refreshAction(refreshToken);
    const refreshApiAction = refreshedAction[actionKey];
    const refreshApiActionMeta = get(refreshApiAction, 'meta', {});
    const refreshArgs = getFetchArgs(
      refreshApiAction.payload,
      token,
      refreshApiActionMeta.authenticate,
    );
    try {
      const newToken = await fetchNewToken(
        refreshArgs,
        refreshApiActionMeta,
        checkResponseIsOk,
      );  
      return apiCallMethod(
        action,
        getFetchArgs,
        newToken,
        checkResponseIsOk,
      );
    } catch (error) {
      dispatch(createFailureAction(action.type, error, action.meta));
      return catchApiRequestError(action.type, error);
    }

  } else {
    try {
      return apiCallMethod(
        action,
        dispatch,
        token,
        getFetchArgs,
        checkResponseIsOk,
      );
    } catch (error) {
      dispatch(createFailureAction(action.type, error, action.meta));
      return catchApiRequestError(action.type, error);
    }
  }
};
