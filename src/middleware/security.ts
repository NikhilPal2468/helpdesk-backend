import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { validationResult, ValidationChain } from 'express-validator';

export type { Request, Response, NextFunction };

const isProduction = process.env.NODE_ENV === 'production';

/**
 * CORS: allow mobile app and admin panel origins.
 * In development, allow all; in production, restrict to configured origins.
 */
const allowedOrigins: string[] = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8081',
  'exp://192.168.0.0.0:8081',
];

if (process.env.ADMIN_ORIGIN) {
  allowedOrigins.push(process.env.ADMIN_ORIGIN);
}
if (process.env.MOBILE_ORIGIN) {
  allowedOrigins.push(process.env.MOBILE_ORIGIN);
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!isProduction || !origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

/**
 * General API rate limit: 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limit for auth endpoints (send-otp, verify-otp, login).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limit for payment-related endpoints.
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many payment requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Run express-validator validations and return 400 with errors if invalid.
 * Use in routes: runValidations([ body('field').trim().isLength({ min: 1 }) ])
 */
export function runValidations(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
  };
}
