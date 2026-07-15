import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

// Fallback STUN-only config (used while fetching TURN credentials)
const FALLBACK_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export const useWebRTC = (localStream, userId) => {
  const { socket } = useSocket();
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef = useRef({});
  const localStreamRef = useRef(localStream);
  const iceConfigRef = useRef(FALLBACK_ICE);

  // Fetch TURN credentials from Metered on mount
  useEffect(() => {
    const fetchTurnCredentials = async () => {
      try {
        const res = await fetch(
          'https://anujx.metered.live/api/v1/turn/credentials?apiKey=3316b129175fc38cb1e9ca7b74de883411c3'
        );
        const iceServers = await res.json();
        console.log('📡 [WebRTC] ✅ Got TURN credentials from Metered:', iceServers.length, 'servers');
        iceConfigRef.current = { iceServers };
      } catch (err) {
        console.warn('📡 [WebRTC] ⚠️ Failed to fetch TURN credentials, using STUN-only fallback:', err.message);
      }
    };
    fetchTurnCredentials();
  }, []);

  // Keep localStreamRef in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Destroy ALL peer connections — used on unmount
  const destroyAllPeers = useCallback(() => {
    console.log('📡 [WebRTC] Destroying all peer connections');
    Object.keys(peersRef.current).forEach(peerId => {
      try {
        peersRef.current[peerId].close();
      } catch (e) { /* ignore */ }
    });
    peersRef.current = {};
    setRemoteStreams({});
  }, []);

  const removePeerConnection = useCallback((targetUserId) => {
    const pc = peersRef.current[targetUserId];
    if (pc) {
      console.log(`📡 [WebRTC] Removing peer connection for ${targetUserId}`);
      try { pc.close(); } catch (e) { /* ignore */ }
      delete peersRef.current[targetUserId];
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[targetUserId];
        return next;
      });
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId, targetSocketId, isInitiator) => {
    // Always destroy existing connection to this user first
    if (peersRef.current[targetUserId]) {
      console.log(`📡 [WebRTC] Replacing stale peer for ${targetUserId}`);
      try { peersRef.current[targetUserId].close(); } catch (e) { /* ignore */ }
      delete peersRef.current[targetUserId];
    }

    console.log(`📡 [WebRTC] Creating peer (initiator: ${isInitiator}) for ${targetUserId}`);
    const pc = new RTCPeerConnection(iceConfigRef.current);
    pc._iceCandidateQueue = [];

    // Add all local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`📡 [WebRTC] Adding local ${track.kind} track`);
        pc.addTrack(track, stream);
      });
    } else {
      console.warn('⚠️ [WebRTC] No local stream available!');
    }

    // ICE candidate → relay to remote peer
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
      console.log(`📡 [WebRTC] ICE gathering: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`📡 [WebRTC] ICE connection: ${pc.iceConnectionState}`);
      // Try ICE restart on failure
      if (pc.iceConnectionState === 'failed') {
        console.log('📡 [WebRTC] Attempting ICE restart...');
        pc.restartIce();
      }
    };

    // Remote tracks received → store the stream
    pc.ontrack = (event) => {
      console.log(`📡 [WebRTC] ✅ Received remote ${event.track.kind} from ${targetUserId}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: remoteStream
      }));
    };

    pc.onconnectionstatechange = () => {
      console.log(`📡 [WebRTC] Connection: ${pc.connectionState} for ${targetUserId}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Don't auto-remove on failed — ICE restart may recover it
        if (pc.connectionState === 'closed') {
          removePeerConnection(targetUserId);
        }
      }
    };

    // Initiator creates and sends the offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log(`📡 [WebRTC] Offer sent to ${targetUserId}`);
          socket.emit('webrtc-offer', {
            targetSocketId,
            offer: pc.localDescription,
            callerId: userId
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    peersRef.current[targetUserId] = pc;
    return pc;
  }, [socket, userId, removePeerConnection]);

  // Wire up socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleParticipantJoined = ({ userId: joinedUserId, socketId }) => {
      if (joinedUserId === userId) return;
      console.log(`📡 [WebRTC] Participant joined: ${joinedUserId}`);
      createPeerConnection(joinedUserId, socketId, true);
    };

    const processIceQueue = async (pc) => {
      if (pc._iceCandidateQueue?.length > 0) {
        console.log(`📡 [WebRTC] Flushing ${pc._iceCandidateQueue.length} queued ICE candidates`);
        const queue = [...pc._iceCandidateQueue];
        pc._iceCandidateQueue = [];
        for (const candidate of queue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('ICE queue error:', e);
          }
        }
      }
    };

    const handleOffer = async ({ callerSocketId, callerId, offer }) => {
      if (callerId === userId) return;
      console.log(`📡 [WebRTC] Received offer from ${callerId}`);
      const pc = createPeerConnection(callerId, callerSocketId, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processIceQueue(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`📡 [WebRTC] Answer sent to ${callerId}`);
        socket.emit('webrtc-answer', {
          targetSocketId: callerSocketId,
          answer: pc.localDescription,
          answererId: userId
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

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
        console.warn(`⚠️ [WebRTC] No peer for answerer ${answererId}`);
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
      const pc = peersRef.current[senderId];
      if (!pc) {
        console.warn(`⚠️ [WebRTC] ICE for unknown peer ${senderId}`);
        return;
      }
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        pc._iceCandidateQueue.push(candidate);
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

  // CRITICAL: Clean up ALL peer connections when this hook unmounts (leaving a meeting)
  useEffect(() => {
    return () => {
      destroyAllPeers();
    };
  }, [destroyAllPeers]);

  return { remoteStreams, removePeerConnection };
};
