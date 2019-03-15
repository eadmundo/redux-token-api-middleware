import isFunction from 'lodash.isfunction';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';

export const getApiFetchArgsFromActionPayload = (
  payload,
  token,
  authenticate,
  requestHeaders,
  createRequestOptions,
  preProcessRequest,
) => {
  let { headers, endpoint, method, body, credentials } = payload;
  if (isUndefined(method)) {
    method = 'GET';
  }

  headers = { ...requestHeaders, ...headers };

  if (token && authenticate) {
    (
      { headers, body } = createRequestOptions(
        headers, body, token,
      )
    );
  }
  if (isFunction(preProcessRequest)) {
    (
      { headers, endpoint, body } = preProcessRequest(
        headers, endpoint, body
      )
    );
  }

  return [
    endpoint,
    omitBy({method, body, credentials, headers}, isUndefined),
  ];
};
