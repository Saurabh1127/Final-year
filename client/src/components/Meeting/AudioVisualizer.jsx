import React, { useState, useEffect, useRef } from 'react';

/**
 * AudioVisualizer
 * Real-time audio waveform / frequency visualizer using Web Audio API.
 * Displays dynamic multi-bar meter reacting to microphone input.
 */
export function AudioVisualizer({
  stream,
  isMuted = false,
  barCount = 20,
}) {
  const [bars, setBars] = useState(() => Array(barCount).fill(4));
  const [level, setLevel] = useState(0);
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);

  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);

  // Check for active audio track
  useEffect(() => {
    if (!stream) {
      setHasAudioTrack(false);
      return;
    }
    const audioTracks = stream.getAudioTracks();
    setHasAudioTrack(audioTracks.some((t) => t.readyState === 'live'));
  }, [stream]);

  // AudioContext & Analyser setup
  useEffect(() => {
    if (!stream || isMuted) {
      setBars(Array(barCount).fill(4));
      setLevel(0);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    let isCancelled = false;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // gives 32 frequency bins
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const render = () => {
        if (isCancelled) return;

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        const newBars = [];
        const binStep = Math.max(1, Math.floor(dataArray.length / barCount));

        for (let i = 0; i < barCount; i++) {
          const binIndex = Math.min(i * binStep, dataArray.length - 1);
          const val = dataArray[binIndex] || 0;
          sum += val;
          // Scale 0-255 to min 4px, max 34px
          const barHeight = Math.max(4, Math.round((val / 255) * 34));
          newBars.push(barHeight);
        }

        const avg = sum / (barCount * 255);
        const calculatedLevel = Math.min(100, Math.round(avg * 140));

        setBars(newBars);
        setLevel(calculatedLevel);

        animFrameRef.current = requestAnimationFrame(render);
      };

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (!isCancelled) render();
        }).catch(() => {});
      } else {
        render();
      }
    } catch (err) {
      console.warn('AudioVisualizer setup note:', err);
    }

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch {}
      }
    };
  }, [stream, isMuted, barCount]);

  // Test sound: plays a friendly dual-tone chime through speakers
  const handlePlayTestTone = () => {
    if (isPlayingTestTone) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      setIsPlayingTestTone(true);

      const now = ctx.currentTime;
      // Tone 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      // Tone 2: 783.99 Hz (G5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(783.99, now + 0.14);
      gain2.gain.setValueAtTime(0.12, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.45);

      setTimeout(() => {
        setIsPlayingTestTone(false);
        try { ctx.close(); } catch {}
      }, 550);
    } catch (err) {
      console.warn('Audio test failed:', err);
      setIsPlayingTestTone(false);
    }
  };

  return (
    <div className="sam-audiovisualizer">
      <div className="sam-audiovisualizer__header">
        <div className="sam-audiovisualizer__title-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: isMuted ? '#F43F5E' : '#00D4B2' }}>
            {isMuted ? (
              <>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            ) : (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            )}
          </svg>
          <span className="sam-audiovisualizer__title">Audio Input Test</span>
        </div>

        <span
          className={`sam-audiovisualizer__badge ${
            isMuted
              ? 'sam-audiovisualizer__badge--muted'
              : level > 12
              ? 'sam-audiovisualizer__badge--speaking'
              : 'sam-audiovisualizer__badge--ready'
          }`}
        >
          {isMuted
            ? 'Muted'
            : !hasAudioTrack
            ? 'No Mic'
            : level > 12
            ? 'Speaking'
            : 'Listening'}
        </span>
      </div>

      {/* Waveform Bars */}
      <div className="sam-audiovisualizer__bars-container" aria-label="Microphone input volume spectrum">
        {bars.map((h, i) => (
          <div
            key={i}
            className="sam-audiovisualizer__bar"
            style={{
              height: `${h}px`,
              opacity: isMuted ? 0.3 : 0.6 + (h / 34) * 0.4,
              backgroundColor: isMuted
                ? '#475569'
                : h > 20
                ? '#38BDF8'
                : '#00D4B2',
            }}
          />
        ))}
      </div>

      {/* Footer Level & Test Sound */}
      <div className="sam-audiovisualizer__footer">
        <div className="sam-audiovisualizer__meter">
          <div
            className="sam-audiovisualizer__meter-fill"
            style={{
              width: `${isMuted ? 0 : Math.min(100, level * 1.3)}%`,
              backgroundColor: level > 75 ? '#F59E0B' : '#00D4B2',
            }}
          />
        </div>

        <button
          type="button"
          onClick={handlePlayTestTone}
          className="sam-audiovisualizer__test-btn"
          disabled={isPlayingTestTone}
          title="Play a chime to test your speakers/headphones"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          {isPlayingTestTone ? 'Playing...' : 'Test Sound'}
        </button>
      </div>
    </div>
  );
}

export default AudioVisualizer;
