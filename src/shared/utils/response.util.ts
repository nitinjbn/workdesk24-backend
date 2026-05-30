import { Response } from 'express';
import { ApiResponse } from '../types/base.types';

export class ResponseUtil {
  static success<T>(res: Response, data?: T, message = 'Success'): Response {
    return res.json({
      success: true,
      message,
      data,
    } as ApiResponse<T>);
  }

  static created<T>(res: Response, data?: T, message = 'Created successfully'): Response {
    return res.status(201).json({
      success: true,
      message,
      data,
    } as ApiResponse<T>);
  }

  static badRequest(res: Response, message = 'Bad request'): Response {
    return res.status(400).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return res.status(401).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static forbidden(res: Response, message = 'Forbidden'): Response {
    return res.status(403).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static notFound(res: Response, message = 'Not found'): Response {
    return res.status(404).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static serverError(res: Response, message = 'Internal server error'): Response {
    return res.status(500).json({
      success: false,
      message,
    } as ApiResponse);
  }
}
