import fetch from 'cross-fetch';
import get from 'lodash.get';
import curryRight from 'lodash.curryright';
import identity from 'lodash.identity';
import startsWith from 'lodash.startswith';
import isArrayLikeObject from 'lodash.isarraylikeobject';
import map from 'lodash.map';

import {
  createCompletionAction as createCompletionAsyncAction,
  createStartAction as createStartAsyncAction,
} from '../createAsyncAction';

export const createResponseHandlerWithMeta = (meta) => {
  const baseHandler = meta.responseHandler || identity;
  const handlerToCurry = (response, meta) => (
    baseHandler(response, meta)
  );
  return curryRight(handlerToCurry)(meta);
};

export const responseToCompletion = async (response) => {
  const contentType = response.headers.get('Content-Type');
  const text = await response.text();
  if (contentType && startsWith(contentType, 'application/json')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }
  return text;
};

export const preserveHeaderValues = (meta, response) => {
  const headersToPreserve = meta.preserveHeaders;
  if (Array.isArray(headersToPreserve)) {
    const responseHeaders = response.headers;
    const preservedHeaders = headersToPreserve.reduce((headers, header) => {
      headers[header] = responseHeaders.get(header);
      return headers;
    }, {});
    return { preservedHeaders };
  }
  return {};
};

export const resolveApiResponse = async (
  response,
  responseValidator,
  onCompletion = responseToCompletion,
) => {
  const okResponse = await responseValidator(response);
  const completedResponse = await onCompletion(okResponse);

  return completedResponse;
};

export const requestNewToken = async (
  refreshArgs,
  refreshApiActionMeta,
  responseValidator,
  apiFetch = fetch,
  responseResolver = resolveApiResponse,
  createResponseHandler = createResponseHandlerWithMeta,
) => {
  const responseHandler = createResponseHandler(refreshApiActionMeta);
  const response = await apiFetch(...refreshArgs);
  const resolvedResponse = await responseResolver(response, responseValidator);
  return responseHandler(resolvedResponse);
};

export const apiRequestFromAction = async (
  action,
  dispatch,
  token,
  getFetchArgs,
  responseValidator,
  apiFetch = fetch,
  preserveHeaders = preserveHeaderValues,
  responseResolver = resolveApiResponse,
  createResponseHandler = createResponseHandlerWithMeta,
  createStartAction = createStartAsyncAction,
  createCompletionAction = createCompletionAsyncAction,
) => {
  const initialMeta = get(action, 'meta', {});
  const { type, payload } = action;
  const responseHandler = createResponseHandler(initialMeta);
  dispatch(createStartAction(type, payload, initialMeta));

  if (isArrayLikeObject(payload)) {
    const apiRequests = map(payload, (apiAction) => {
      const fetchArgs = getFetchArgs(
        apiAction,
        token,
      );
      const response = apiFetch(...fetchArgs);
      const resolvedResponse = responseResolver(response, responseValidator);
      return resolvedResponse;
    
    });

    const allResponses = await Promise.all(apiRequests);
    const handledResponses = responseHandler(allResponses);
    
    dispatch(createCompletionAction(
      type,
      handledResponses,
      initialMeta,
    ));

    return handledResponses;
  } else {
  const fetchArgs = getFetchArgs(
    action,
    token,
  );

  const response = await apiFetch(...fetchArgs);
  const meta = { ...initialMeta, ...preserveHeaders(initialMeta, response) };
  const resolvedResponse = await responseResolver(response, responseValidator);
  const handledResponse = responseHandler(resolvedResponse);

  dispatch(createCompletionAction(
    type,
    handledResponse,
    meta,
  ));

  return handledResponse;
  }
};
