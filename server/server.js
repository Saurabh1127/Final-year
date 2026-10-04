import dotenv from 'dotenv';
dotenv.config(); // Load latest .env including Colab AI_SERVICE_URL
import express from 'express';
import http from 'http';
import cors from 'cors';
import connectDB from './config/db.js';
import setupSocket from './socket/index.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Route imports
import authRoutes from './routes/auth.js';
import meetingRoutes from './routes/meetings.js';
import transcriptRoutes from './routes/transcriptRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';
import turnRoutes from './routes/turn.js';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]   // Production: only allow Vercel frontend
  : ['*'];                     // Local dev: allow any origin

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'samvada-server',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meetings', summaryRoutes);   // POST /:meetingId/summarize, GET /:meetingId/summary
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/turn', turnRoutes);

// Setup Socket.IO
const io = setupSocket(server);

// Make io accessible to routes
app.set('io', io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

// Prevent server crashes from killing meetings
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Running on port ${PORT} (bound to 0.0.0.0)`);
    console.log(`[SOCKET] Socket.IO ready`);
    console.log(`[AI] Service URL: ${process.env.AI_SERVICE_URL}`);
  });
});
