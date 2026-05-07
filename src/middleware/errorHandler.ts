import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = err.statusCode ?? 500;
  const message = status === 500 ? 'Internal Server Error' : err.message;

  if (status === 500) {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
  }

  res.status(status).json({ error: message });
}
