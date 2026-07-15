import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

// Free public TURN servers for NAT traversal across different networks
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN relay servers — needed when peers are on different networks
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export const useWebRTC = (localStream, userId) => {
  const { socket } = useSocket();
  const [peers, setPeers] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef = useRef({});
  const localStreamRef = useRef(localStream);

  // Keep localStreamRef in sync so callbacks always have the latest stream
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const createPeerConnection = useCallback((targetUserId, targetSocketId, isInitiator) => {
    // If peer connection already exists, destroy it and create fresh
    if (peersRef.current[targetUserId]) {
      console.log(`📡 [WebRTC] Destroying stale peer for ${targetUserId}, creating new one`);
      peersRef.current[targetUserId].close();
      delete peersRef.current[targetUserId];
    }

    console.log(`📡 [WebRTC] Creating peer connection for ${targetUserId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc._iceCandidateQueue = []; // Queue for candidates that arrive before remote description

    // Add local tracks to the connection
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`📡 [WebRTC] Adding local ${track.kind} track to peer ${targetUserId}`);
        pc.addTrack(track, stream);
      });
    } else {
      console.warn(`⚠️ [WebRTC] No local stream when creating peer for ${targetUserId}`);
    }

    // Send ICE candidates to the remote peer via signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
          senderId: userId
        });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`📡 [WebRTC] ICE gathering state for ${targetUserId}: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`📡 [WebRTC] ICE connection state for ${targetUserId}: ${pc.iceConnectionState}`);
    };

    // When we receive remote tracks, save the stream
    pc.ontrack = (event) => {
      console.log(`📡 [WebRTC] ✅ Received remote ${event.track.kind} track from ${targetUserId}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: remoteStream
      }));
    };

    pc.onconnectionstatechange = () => {
      console.log(`📡 [WebRTC] Connection state for ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        console.error(`📡 [WebRTC] ❌ Connection FAILED for ${targetUserId}`);
        removePeerConnection(targetUserId);
      } else if (pc.connectionState === 'closed') {
        removePeerConnection(targetUserId);
      }
    };

    // If we are the initiator, create and send an offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log(`📡 [WebRTC] Sending offer to ${targetUserId}`);
          socket.emit('webrtc-offer', {
            targetSocketId,
            offer: pc.localDescription,
            callerId: userId
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    peersRef.current[targetUserId] = pc;
    setPeers({ ...peersRef.current });
    return pc;
  }, [socket, userId]);

  const removePeerConnection = useCallback((targetUserId) => {
    if (peersRef.current[targetUserId]) {
      peersRef.current[targetUserId].close();
      delete peersRef.current[targetUserId];
      setPeers({ ...peersRef.current });
      
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[targetUserId];
        return newStreams;
      });
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // When a new participant joins the room, we initiate a WebRTC connection to them
    const handleParticipantJoined = ({ userId: joinedUserId, socketId }) => {
      if (joinedUserId === userId) return;
      console.log(`📡 [WebRTC] Participant joined: ${joinedUserId}, initiating connection`);
      createPeerConnection(joinedUserId, socketId, true);
    };

    // Process any queued ICE candidates after setting remote description
    const processIceQueue = async (pc) => {
      if (pc._iceCandidateQueue && pc._iceCandidateQueue.length > 0) {
        console.log(`📡 [WebRTC] Processing ${pc._iceCandidateQueue.length} queued ICE candidates`);
        for (const candidate of pc._iceCandidateQueue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Failed to add queued ICE candidate:', e);
          }
        }
        pc._iceCandidateQueue = [];
      }
    };

    // Handle incoming WebRTC offer from a remote peer
    const handleOffer = async ({ callerSocketId, callerId, offer }) => {
      if (callerId === userId) return;
      console.log(`📡 [WebRTC] Received offer from ${callerId}`);
      
      const pc = createPeerConnection(callerId, callerSocketId, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processIceQueue(pc);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        console.log(`📡 [WebRTC] Sending answer to ${callerId}`);
        socket.emit('webrtc-answer', {
          targetSocketId: callerSocketId,
          answer: pc.localDescription,
          answererId: userId
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

    // Handle incoming WebRTC answer
    const handleAnswer = async ({ answererId, answer }) => {
      console.log(`📡 [WebRTC] Received answer from ${answererId}`);
      const pc = peersRef.current[answererId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processIceQueue(pc);
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      } else {
        console.warn(`📡 [WebRTC] ⚠️ No peer connection found for answerer ${answererId}`);
      }
    };

    // Handle incoming ICE candidate
    const handleIceCandidate = async ({ senderId, candidate }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        } else {
          // Queue candidate — remote description hasn't been set yet
          pc._iceCandidateQueue.push(candidate);
        }
      } else {
        console.warn(`📡 [WebRTC] ⚠️ ICE candidate received for unknown peer ${senderId}`);
      }
    };

    const handleParticipantLeft = ({ userId: leftUserId }) => {
      console.log(`📡 [WebRTC] Participant left: ${leftUserId}`);
      removePeerConnection(leftUserId);
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('participant-left', handleParticipantLeft);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('participant-left', handleParticipantLeft);
    };
  }, [socket, createPeerConnection, removePeerConnection, userId]);

  return { peers, remoteStreams, createPeerConnection, removePeerConnection };
};
