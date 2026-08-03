require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const setupSocket = require('./socket');

// Route imports
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const transcriptRoutes = require('./routes/transcriptRoutes');
const summaryRoutes = require('./routes/summaryRoutes');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'linguameet-server',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meetings', summaryRoutes);   // POST /:meetingId/summarize, GET /:meetingId/summary
app.use('/api/transcripts', transcriptRoutes);

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
