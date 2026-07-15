const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const meetingHandlers = require('./meetingHandlers');
const signalingHandlers = require('./signalingHandlers');
const Meeting = require('../models/Meeting');

const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket.IO Middleware for Auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Attach user info
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.user.userId})`);

    // Register handlers
    meetingHandlers(io, socket);
    signalingHandlers(io, socket);

    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
      
      // Cleanup participant state on disconnect
      if (socket.roomCode && socket.userId) {
        try {
          const meeting = await Meeting.findOne({ roomCode: socket.roomCode });
          if (meeting) {
            const participant = meeting.participants.find(p => p.userId.toString() === socket.userId);
            if (participant) {
              participant.isActive = false;
              participant.socketId = null;
              await meeting.save();
            }
          }
          socket.to(socket.roomCode).emit('participant-left', { 
            userId: socket.userId, 
            socketId: socket.id 
          });
        } catch (error) {
          console.error('Error during disconnect cleanup:', error);
        }
      }
    });
  });

  return io;
};

module.exports = setupSocket;
