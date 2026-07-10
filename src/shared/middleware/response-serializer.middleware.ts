import { Request, Response, NextFunction } from 'express';
import { convertNumericFields } from '../utils/data-type-converter.util';

/**
 * Middleware to serialize API responses
 * - Converts numeric string fields to proper numbers (BIGINT issue)
 * - Applied globally to all responses
 */
export function responseSerializerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to intercept responses
  res.json = function(data: any) {
    // Convert numeric fields in the response
    const serialized = convertNumericFields(data);
    
    // Call original json with converted data
    return originalJson(serialized);
  };

  next();
}

export default responseSerializerMiddleware;
