const Meeting = require('../models/Meeting');

module.exports = (io, socket) => {
  // Join a meeting room
  socket.on('join-meeting', async ({ roomCode, userId, displayName, targetLanguage, isMuted, isVideoOff }) => {
    try {
      console.log(`Socket ${socket.id} joining room ${roomCode} for user ${userId}`);
      
      const meeting = await Meeting.findOne({ roomCode, status: { $ne: 'ended' } });
      if (!meeting) {
        return socket.emit('error', { message: 'Meeting not found' });
      }

      // Check if participant already exists in the meeting
      let participant = meeting.participants.find(p => p.userId.toString() === userId);
      
      if (participant) {
        participant.socketId = socket.id;
        participant.isActive = true;
        participant.displayName = displayName || participant.displayName;
        participant.targetLanguage = targetLanguage || participant.targetLanguage;
      } else {
        meeting.participants.push({
          userId,
          displayName,
          targetLanguage,
          socketId: socket.id,
          isActive: true
        });
      }

      await meeting.save();
      
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

      const meeting = await Meeting.findOne({ roomCode });
      if (meeting) {
        const participant = meeting.participants.find(p => p.userId.toString() === userId);
        if (participant) {
          participant.isActive = false;
          participant.socketId = null;
          await meeting.save();
        }
      }

      socket.to(roomCode).emit('participant-left', { userId, socketId: socket.id });
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  });
};
