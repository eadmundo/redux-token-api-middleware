import jwt_decode from 'jwt-decode';
import moment from 'moment';

export const defaultAddtokenToRequest = (headers, body, token) => {
  return {
    headers: Object.assign({
      Authorization: `JWT ${token}`,
    }, headers),
    body,
  };
};

export const defaultCheckResponseIsOk = (response) => {
  return response.ok ? response : response.text().then(text => {
    return Promise.reject(text);
  });
};

export const defaultApiRequestErrorHandler = (type, error) => {
  return error;
};

export const defaultRetrieveToken = (key) => {
  const storedValue = localStorage.getItem(key);
  if (!storedValue) {
    return null;
  }
  try {
    return JSON.parse(storedValue);
  }
  catch (e) {
    if (e instanceof SyntaxError) {
      return null;
    }
    throw e;
  }
};

export const defaultCheckTokenFreshness = (
  token,
  minTokenLifespan,
) => {
  const tokenPayload = jwt_decode(token);
  const expiry = moment.unix(tokenPayload.exp);
  return expiry.diff(moment(), 'seconds') > minTokenLifespan;
};

export const defaultShouldRequestNewToken = (
  refreshToken,
  checkTokenFreshness,
  retrieveToken,
  tokenStorageKey,
  minTokenLifespan,
  ) => {
  if (!refreshToken) {
    return false;
  }
  const token = retrieveToken(tokenStorageKey);
  return token
    ? checkTokenFreshness(token, minTokenLifespan)
    : false;
};
