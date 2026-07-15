module.exports = (io, socket) => {
  // WebRTC Signaling: Offer
  socket.on('webrtc-offer', ({ targetSocketId, offer, callerId }) => {
    console.log(`Relaying offer from ${socket.id} to ${targetSocketId}`);
    socket.to(targetSocketId).emit('webrtc-offer', {
      callerSocketId: socket.id,
      callerId,
      offer
    });
  });

  // WebRTC Signaling: Answer
  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    console.log(`Relaying answer from ${socket.id} to ${targetSocketId}`);
    socket.to(targetSocketId).emit('webrtc-answer', {
      answererSocketId: socket.id,
      answer
    });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${targetSocketId}`);
    socket.to(targetSocketId).emit('ice-candidate', {
      senderSocketId: socket.id,
      candidate
    });
  });
};
