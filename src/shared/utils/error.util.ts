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

export const createConfiguredError = (
  key: string,
  defaultMessage?: string,
  statusCode: number = 400,
  errorCode: string = 'VALIDATION_ERROR'
): AppError => {
  const byKey = errorConfig[key];

  if (!byKey) {
    return createAppError(
      errorCode,
      statusCode,
      defaultMessage || 'Something went wrong'
    );
  }

  return createAppError(byKey.code, byKey.status, byKey.message);
};
