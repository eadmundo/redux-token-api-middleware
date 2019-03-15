const ASYNC_OPTIMIST_MAP = {
  START: 'BEGIN',
  COMPLETED: 'COMMIT',
  FAILED: 'REVERT',
};

export const createAsyncAction = (type, step, payload, meta = {}) => {
  const action = {
    type: `${type}_${step}`,
    payload: payload,
    meta: Object.assign(
      meta,
      { asyncStep: step },
    ),
  };
  if (payload && payload instanceof Error) {
    Object.assign(action.meta, {
      error: true,
    });
  }
  const { optimistId } = meta;
  if (optimistId !== undefined) {
    Object.assign(action, {
      optimist: {
        type: ASYNC_OPTIMIST_MAP[step],
        id: optimistId,
      },
    });
  }
  return action;
};

export const createStartAction = (type, payload, meta) => (
  createAsyncAction(type, 'START', payload, meta)
);

export const createCompletionAction = (type, payload, meta) => (
  createAsyncAction(type, 'COMPLETED', payload, meta)
);

export const createFailureAction = (type, error, meta) => (
  createAsyncAction(type, 'FAILED', new TypeError(error), meta)
);
