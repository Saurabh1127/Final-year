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
app.use(cors({
  origin: '*',   // Allow any origin — required for ngrok + cross-device testing
  credentials: false,
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
  console.error('❌ Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} (bound to 0.0.0.0)`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🤖 AI service URL: ${process.env.AI_SERVICE_URL}`);
  });
});
