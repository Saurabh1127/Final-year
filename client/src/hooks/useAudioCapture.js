import { useState, useCallback, useRef } from 'react';

export const useAudioCapture = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  const startCapture = useCallback(async (enableVideo = true) => {
    // CRITICAL: Always release any existing stream before requesting a new one.
    // Without this, the camera stays locked from the previous meeting.
    if (streamRef.current) {
      console.log('🎤 [Media] Releasing previous media stream before requesting new one');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      console.log(`🎤 [Media] Requesting media (video: ${enableVideo}, audio: true)`);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: enableVideo 
      });
      console.log(`🎤 [Media] ✅ Got stream with ${stream.getTracks().length} tracks`);
      streamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      setIsMuted(false);
      setIsVideoOff(!enableVideo);
    } catch (err) {
      console.error('🎤 [Media] ❌ Error accessing media:', err.name, err.message);
      // If video+audio fails, try audio-only as fallback
      if (enableVideo) {
        console.log('🎤 [Media] Falling back to audio-only');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          streamRef.current = audioStream;
          setLocalStream(audioStream);
          setError(null);
          setIsMuted(false);
          setIsVideoOff(true);
          return;
        } catch (audioErr) {
          console.error('🎤 [Media] ❌ Audio-only also failed:', audioErr.name);
        }
      }
      setError('Could not access camera/microphone. Please check permissions.');
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      console.log('🎤 [Media] Stopping all tracks');
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`🎤 [Media] Stopped ${track.kind} track`);
      });
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
        // Simply flip the enabled state
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
