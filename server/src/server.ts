import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { notFound, errorHandler } from './middleware/error.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import apiRouter from './routes/index.js';
import connectDB from './config/db.js';
import { startScheduledJobs } from './services/scheduler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(helmet());
app.use(
  cors({
    // Browsers match Access-Control-Allow-Origin exactly, so a trailing
    // slash in CLIENT_URL would break every request — strip it defensively
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(apiRateLimiter as any);

// Mount API router
app.use('/api', apiRouter);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'OptiCart Backend API is operational' });
});

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB then start the server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startScheduledJobs();
  });
});

export default app;
