import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import tutorRouter from './routes/tutor';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRouter);
app.use('/api/tutor-cmdq', tutorRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Centralised error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running`, { port: PORT, env: process.env.NODE_ENV ?? 'development' });
});

export default app;
