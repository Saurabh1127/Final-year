import { useState, useEffect } from 'react';

export const useAudioVolume = (stream) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream) return;
    
    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    let audioContext;
    let analyser;
    let source;
    let animationFrame;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Lowered threshold to 2 for higher sensitivity. 
        // This is the "real-time audio check" for the user.
        setIsSpeaking(average > 2);
        
        animationFrame = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.error('Error analyzing audio volume:', err);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(console.error);
      }
    };
  }, [stream]);

  return isSpeaking;
};
