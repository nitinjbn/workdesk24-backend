import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const code = error.code;

  res.status(statusCode).json({
    success: false,
    ...(code && { code }),
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};
