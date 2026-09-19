import { useState, useCallback, useRef, useEffect } from 'react';

export const useAudioCapture = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const isMountedRef = useRef(true);
  const captureSessionIdRef = useRef(0);

  // Helper to reliably stop all tracks, explicitly releasing video/camera first
  const stopStreamTracks = (stream) => {
    if (!stream) return;
    try {
      // 1. Stop video tracks first to release camera hardware/light immediately
      stream.getVideoTracks().forEach(track => {
        try {
          track.stop();
          console.log('📹 [Media] Camera video track stopped');
        } catch (e) {
          console.warn('Error stopping video track:', e);
        }
      });
      // 2. Stop remaining tracks
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
    } catch (e) {
      console.warn('Error in stopStreamTracks:', e);
    }
  };

  // Self-cleanup on unmount: always stop camera and capture tracks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      captureSessionIdRef.current++;
      if (streamRef.current) {
        console.log('📹 [Media] Hook unmounted — stopping all tracks');
        stopStreamTracks(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  const startCapture = useCallback(async (enableVideo = true) => {
    isMountedRef.current = true;
    const currentSessionId = ++captureSessionIdRef.current;

    // CRITICAL: Always release any existing stream before requesting a new one.
    if (streamRef.current) {
      console.log('📹 [Media] Releasing previous media stream before requesting new one');
      stopStreamTracks(streamRef.current);
      streamRef.current = null;
    }

    try {
      console.log(`📹 [Media] Requesting media (video: ${enableVideo}, audio: true)`);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: enableVideo 
      });

      // If component unmounted or capture was cancelled/superseded while getUserMedia was in-flight:
      if (!isMountedRef.current || currentSessionId !== captureSessionIdRef.current) {
        console.log('📹 [Media] getUserMedia completed after unmount/cancel — stopping orphaned tracks immediately');
        stopStreamTracks(stream);
        return;
      }

      // If another stream was somehow set while this promise resolved:
      if (streamRef.current) {
        stopStreamTracks(streamRef.current);
      }

      console.log(`📹 [Media] ✅ Got stream with ${stream.getTracks().length} tracks`);
      streamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      setIsMuted(false);
      setIsVideoOff(!enableVideo);
    } catch (err) {
      console.error('📹 [Media] ❌ Error accessing media:', err.name, err.message);
      if (!isMountedRef.current || currentSessionId !== captureSessionIdRef.current) return;

      // If video+audio fails, try audio-only as fallback
      if (enableVideo) {
        console.log('📹 [Media] Falling back to audio-only');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (!isMountedRef.current || currentSessionId !== captureSessionIdRef.current) {
            stopStreamTracks(audioStream);
            return;
          }
          if (streamRef.current) {
            stopStreamTracks(streamRef.current);
          }
          streamRef.current = audioStream;
          setLocalStream(audioStream);
          setError(null);
          setIsMuted(false);
          setIsVideoOff(true);
          return;
        } catch (audioErr) {
          console.error('📹 [Media] ❌ Audio-only also failed:', audioErr.name);
        }
      }
      setError('Could not access camera/microphone. Please check permissions.');
    }
  }, []);

  const stopCapture = useCallback(() => {
    isMountedRef.current = false;
    captureSessionIdRef.current++;
    if (streamRef.current) {
      console.log('📹 [Media] Stopping all tracks (camera + audio)');
      stopStreamTracks(streamRef.current);
      streamRef.current = null;
      setLocalStream(null);
      setIsMuted(false);
      setIsVideoOff(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMuted(!audioTracks[0].enabled); // muted = NOT enabled
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setIsVideoOff(!videoTracks[0].enabled); // videoOff = NOT enabled
      }
    }
  }, []);

  return { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error };
};
