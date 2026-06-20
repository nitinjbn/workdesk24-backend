import errorConfigJson from '../../config/error.json';

interface ErrorConfigItem {
  code: string;
  status: number;
  message: string;
}

type ErrorConfigMap = Record<string, ErrorConfigItem>;

export interface AppError extends Error {
  code: string;
  statusCode: number;
}

const errorConfig = errorConfigJson as ErrorConfigMap;

const createAppError = (code: string, statusCode: number, message: string): AppError => {
  const error = new Error(message) as AppError;
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

export const createConfiguredError = (key: string, code?: string): AppError => {
  const byKey = errorConfig[key];
  const byCode = code
    ? Object.values(errorConfig).find((item) => item.code === code)
    : undefined;
  const selected = byKey || byCode;

  if (!selected) {
    return createAppError(
      'INTERNAL_SERVER_ERROR',
      500,
      'Something went wrong'
    );
  }

  return createAppError(selected.code, selected.status, selected.message);
};
