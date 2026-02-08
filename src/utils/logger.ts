import fs from 'fs';
import path from 'path';
import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  isProduction ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple())
);

const transports: winston.transport[] = [new winston.transports.Console()];
const logDir = process.env.LOG_DIR || 'logs';
if (isProduction && logDir) {
  try {
    const dir = path.isAbsolute(logDir) ? logDir : path.join(process.cwd(), logDir);
    fs.mkdirSync(dir, { recursive: true });
    transports.push(new winston.transports.File({ filename: path.join(dir, 'error.log'), level: 'error' }));
    transports.push(new winston.transports.File({ filename: path.join(dir, 'combined.log') }));
  } catch {
    // ignore if logs dir cannot be created
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'school-admission-api' },
  transports,
});

/** Log HTTP request (method, path, status, duration). */
export function logRequest(method: string, path: string, statusCode: number, durationMs: number, meta?: Record<string, unknown>) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger.log(level, `${method} ${path} ${statusCode} ${durationMs}ms`, { method, path, statusCode, durationMs, ...meta });
}
