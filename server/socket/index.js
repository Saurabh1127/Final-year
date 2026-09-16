import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import meetingHandlers from './meetingHandlers.js';
import signalingHandlers from './signalingHandlers.js';
import meetingService from '../services/meetingService.js';
import { handleAudioChunk, unregisterParticipant } from '../translation/orchestrator.js';

const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',   // Allow any origin — required for ngrok + cross-device testing
      methods: ['GET', 'POST'],
      credentials: false,
    },
    maxHttpBufferSize: 2e6, // 2MB — enough for audio chunks (~50-200KB each)

    // ── Stable connection settings (like Zoom/Meet) ──────────────────
    // Default (20s ping interval, 5s timeout) is too aggressive for ngrok tunnels
    // carrying large audio binary payloads. Increase so audio processing doesn't
    // starve the heartbeat and cause false disconnections.
    pingInterval: 25000,   // Send keepalive ping every 25s
    pingTimeout: 60000,    // Wait 60s for pong before declaring disconnect
    upgradeTimeout: 30000, // Give websocket upgrade more time over ngrok

    // Connection state recovery: auto-restore missed events after brief drops
    // without the client needing a full re-join flow
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // Recover drops up to 2 mins
      skipMiddlewares: true,
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

    // Audio-chunk handler: binary audio from speaking participant → AI service → translation-result
    socket.on('audio-chunk', (audioBuffer, metadata) =>
      handleAudioChunk(io, socket, audioBuffer, metadata)
    );

    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
      
      // Cleanup participant state on disconnect
      if (socket.roomCode && socket.userId) {
        try {
          // Remove from orchestrator participant registry
          unregisterParticipant(socket.roomCode, socket.id);

          await meetingService.leaveMeeting({ roomCode: socket.roomCode, userId: socket.userId });
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

export default setupSocket;
