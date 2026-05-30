import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  errors?: any[];
}

export default function errorHandler(
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);

  if (err.name === 'SequelizeValidationError') {
    res.status(400).json({
      message: 'Validation error',
      errors: err.errors?.map((e: any) => ({ field: e.path, message: e.message })),
    });
    return;
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    res.status(409).json({
      message: 'Resource already exists',
      errors: err.errors?.map((e: any) => ({ field: e.path, message: e.message })),
    });
    return;
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
  });
}
