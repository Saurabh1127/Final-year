require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const setupSocket = require('./socket');

// Route imports
const authRoutes = require('./routes/auth');

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
const meetingRoutes = require('./routes/meetings');
app.use('/api/meetings', meetingRoutes);

// Setup Socket.IO
const io = setupSocket(server);

// Make io accessible to routes
app.set('io', io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🤖 AI service URL: ${process.env.AI_SERVICE_URL}`);
  });
});
