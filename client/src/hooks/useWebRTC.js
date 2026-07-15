import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

export const useWebRTC = (localStream, userId) => {
  const { socket } = useSocket();
  const [peers, setPeers] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef = useRef({});

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const createPeerConnection = useCallback((targetUserId, targetSocketId, isInitiator) => {
    if (peersRef.current[targetUserId]) {
      return peersRef.current[targetUserId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
          senderId: userId
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: event.streams[0]
      }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removePeerConnection(targetUserId);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
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
  }, [localStream, socket, userId]);

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

    const handleParticipantJoined = ({ userId: joinedUserId, socketId }) => {
      if (joinedUserId === userId) return;
      createPeerConnection(joinedUserId, socketId, true);
    };

    const handleOffer = async ({ callerSocketId, callerId, offer }) => {
      if (callerId === userId) return;
      
      const pc = createPeerConnection(callerId, callerSocketId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc-answer', {
        targetSocketId: callerSocketId,
        answer: pc.localDescription,
        answererId: userId
      });
    };

    const handleAnswer = async ({ answererId, answer }) => {
      const pc = peersRef.current[answererId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleParticipantLeft = ({ userId: leftUserId }) => {
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
