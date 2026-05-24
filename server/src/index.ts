import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as IOServer } from 'socket.io';

import sessionRouter from './routes/session';
import reposRouter from './routes/repos';
import leaderboardRouter from './routes/leaderboard';
import { registerSocketHandlers } from './socket';
import { getDb } from './db';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is required');
  process.exit(1);
}

// Warm up the database connection
getDb();

const app = express();
const server = http.createServer(app);

const io = new IOServer(server, {
  cors: { origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
});

registerSocketHandlers(io);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'ws://localhost:*', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
  })
);

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json({ limit: '10kb' }));

// Rate limiters
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const reposLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const leaderboardReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const leaderboardWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

app.use('/api/repos', reposLimiter, reposRouter);
app.use('/api/session', reposLimiter, sessionRouter);
app.use('/api/leaderboard', (req, res, next) => {
  if (req.method === 'POST') {
    leaderboardWriteLimiter(req, res, next);
  } else {
    leaderboardReadLimiter(req, res, next);
  }
});
app.use('/api/leaderboard', leaderboardRouter);
app.use(defaultLimiter);

// Serve built frontend in production
const publicDir = path.join(__dirname, '../public');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`StarGuessr server running on http://localhost:${PORT}`);
});
