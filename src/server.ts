import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { corsOptions, apiLimiter, authLimiter, paymentLimiter } from './middleware/security';
import { logger, logRequest } from './utils/logger';

// Routes
import authRoutes from './routes/auth';
import applicationRoutes from './routes/application';
import documentRoutes from './routes/documents';
import pdfRoutes from './routes/pdf';
import aiRoutes from './routes/ai';
import adminRoutes from './routes/admin';
import adminContentRoutes from './routes/admin-content';
import exploreRoutes from './routes/explore';
import seedRoutes from './routes/seed';
import paymentRoutes from './routes/payment';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Trust proxy (required for Cloud Run / load balancers so rate-limit sees real client IP)
app.set('trust proxy', 1);

// Security: helmet (headers)
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for API; enable if serving HTML

// CORS: configured origins in production
app.use(cors(corsOptions));

// Rate limiting
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (method, path, status, duration)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logRequest(req.method, req.path, res.statusCode, Date.now() - start);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes (auth and payment have stricter rate limits)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/application', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminContentRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/payment', paymentLimiter, paymentRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? 500;
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // required for Cloud Run to reach the container

app.listen(Number(PORT), HOST, () => {
  logger.info(`Server running on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
