import meetingService from '../services/meetingService.js';
import {
  registerParticipant,
  unregisterParticipant,
  updateParticipantLanguage,
} from '../translation/orchestrator.js';

export default (io, socket) => {
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
      
      // Evict any stale socket for this user already in the room (e.g. from previous tab/session)
      const existingSockets = await io.in(roomCode).fetchSockets();
      for (const s of existingSockets) {
        if (s.userId?.toString() === userId?.toString() && s.id !== socket.id) {
          console.log(`🔌 [Meeting] Evicting stale socket ${s.id} for user ${userId} in room ${roomCode}`);
          unregisterParticipant(roomCode, s.id);
          s.leave(roomCode);
          s.emit('session-replaced', { message: 'You have joined this meeting from another tab or window.' });
        }
      }

      // Join the socket room
      socket.join(roomCode);
      
      // Store current room on the socket object for easy access during disconnect
      socket.roomCode = roomCode;
      socket.userId = userId;

      // Register with the translation orchestrator
      registerParticipant(roomCode, socket.id, {
        userId,
        speakerName: displayName,
        targetLanguage: targetLanguage || 'en',
      });

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

      // 1. Deregister from orchestrator before leaving
      unregisterParticipant(roomCode, socket.id);

      // 2. Broadcast to remaining participants BEFORE leaving room
      io.to(roomCode).emit('participant-left', { userId, socketId: socket.id });

      // 3. Leave the room and clean socket state
      socket.leave(roomCode);
      socket.roomCode = null;
      socket.userId = null;

      // 4. Update database
      await meetingService.leaveMeeting({ roomCode, userId });
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  });

  // Host ends meeting for all participants
  socket.on('end-meeting', async ({ roomCode }) => {
    try {
      const hostId = socket.userId || socket.user?.userId;
      console.log(`👑 [Meeting] Host ${hostId} ending meeting ${roomCode}`);

      await meetingService.endMeeting({ roomCode, hostId });

      // Broadcast to ALL sockets in the room that the meeting has ended
      io.to(roomCode).emit('meeting-ended', {
        message: 'The meeting has been ended by the host.',
        roomCode,
      });

      // Evict and clean up all participants from the room
      const roomSockets = await io.in(roomCode).fetchSockets();
      for (const s of roomSockets) {
        unregisterParticipant(roomCode, s.id);
        s.leave(roomCode);
        s.roomCode = null;
        s.userId = null;
      }
    } catch (error) {
      console.error('Error ending meeting:', error);
      socket.emit('error', { message: error.message || 'Failed to end meeting' });
    }
  });

  // Handle mid-meeting language change
  socket.on('update-language', ({ roomCode, targetLanguage }) => {
    if (!roomCode || !targetLanguage) return;
    updateParticipantLanguage(roomCode, socket.id, targetLanguage);
    console.log(`🌐 [Meeting] ${socket.id} changed language to ${targetLanguage} in room ${roomCode}`);
  });

  // Handle mid-meeting display name rename
  socket.on('rename-participant', ({ roomCode, userId, newDisplayName }) => {
    if (!roomCode || !userId || !newDisplayName?.trim()) return;
    const trimmedName = newDisplayName.trim().slice(0, 50); // cap at 50 chars
    console.log(`✏️ [Meeting] ${userId} renamed to "${trimmedName}" in room ${roomCode}`);
    // Broadcast to all OTHER participants in the room
    socket.to(roomCode).emit('participant-renamed', {
      userId,
      newDisplayName: trimmedName,
    });
  });
};

