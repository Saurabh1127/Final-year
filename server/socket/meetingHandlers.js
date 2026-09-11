const meetingService = require('../services/meetingService');

module.exports = (io, socket) => {
  // Join a meeting room
  socket.on('join-meeting', async ({ roomCode, userId, displayName, targetLanguage, isMuted, isVideoOff }) => {
    try {
      console.log(`Socket ${socket.id} joining room ${roomCode} for user ${userId}`);
      
      const meeting = await meetingService.joinMeeting({
        roomCode,
        userId,
        displayName,
        targetLanguage,
        socketId: socket.id
      });
      
      // Join the socket room
      socket.join(roomCode);
      
      // Store current room on the socket object for easy access during disconnect
      socket.roomCode = roomCode;
      socket.userId = userId;

      // Broadcast to others in the room that a new participant joined
      socket.to(roomCode).emit('participant-joined', {
        userId,
        socketId: socket.id,
        displayName,
        targetLanguage,
        isMuted,
        isVideoOff
      });

      // Send the current participant list back to the joining user
      const activeParticipants = meeting.getActiveParticipants().map(p => ({
        userId: p.userId,
        socketId: p.socketId,
        displayName: p.displayName,
        targetLanguage: p.targetLanguage,
        isMuted: false, // Default fallback, but they will sync shortly
        isVideoOff: false
      }));

      socket.emit('meeting-joined', { participants: activeParticipants });

    } catch (error) {
      console.error('Error joining meeting:', error);
      socket.emit('error', { message: 'Failed to join meeting' });
    }
  });

  // Handle Media Toggle
  socket.on('toggle-media', ({ roomCode, userId, isMuted, isVideoOff }) => {
    socket.to(roomCode).emit('participant-media-changed', {
      userId,
      isMuted,
      isVideoOff
    });
  });

  // Leave a meeting room
  socket.on('leave-meeting', async ({ roomCode, userId }) => {
    try {
      console.log(`Socket ${socket.id} leaving room ${roomCode}`);
      
      socket.leave(roomCode);
      socket.roomCode = null;
      socket.userId = null;

      await meetingService.leaveMeeting({ roomCode, userId });

      socket.to(roomCode).emit('participant-left', { userId, socketId: socket.id });
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  });
};
