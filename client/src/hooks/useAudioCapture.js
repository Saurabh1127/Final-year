import { useState, useEffect, useCallback, useRef } from 'react';

export const useAudioCapture = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  const startCapture = useCallback(async (enableVideo = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: enableVideo });
      setLocalStream(stream);
      streamRef.current = stream;
      setError(null);
      setIsVideoOff(!enableVideo);
    } catch (err) {
      console.error('Error accessing media:', err);
      setError('Could not access camera/microphone. Please check permissions.');
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMutedState = !isMuted;
        audioTracks[0].enabled = !newMutedState;
        setIsMuted(newMutedState);
      }
    }
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        // If we already have a video track, just toggle it
        const newVideoState = !isVideoOff;
        videoTracks[0].enabled = !newVideoState;
        setIsVideoOff(newVideoState);
      } else if (isVideoOff) {
        // If we don't have a video track (started audio only), we need to request it
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = videoStream.getVideoTracks()[0];
          streamRef.current.addTrack(videoTrack);
          // We need to update the state so React re-renders the stream
          setLocalStream(new MediaStream(streamRef.current.getTracks()));
          setIsVideoOff(false);
        } catch (err) {
          console.error('Error accessing camera:', err);
        }
      }
    }
  }, [isVideoOff]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error };
};
