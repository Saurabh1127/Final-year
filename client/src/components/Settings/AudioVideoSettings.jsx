import React, { useState, useEffect, useRef } from 'react';
import { Button, useToast } from '../ui';

/**
 * AudioVideoSettings
 * Hardware device selector, camera video preview, microphone audio visualizer,
 * and audio loopback testing.
 */
export function AudioVideoSettings() {
  const { toast } = useToast();

  const [devices, setDevices] = useState({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');

  const [cameraActive, setCameraActive] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  // 1. Enumerate media devices
  useEffect(() => {
    async function loadDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        const audioOutputs = allDevices.filter((d) => d.kind === 'audiooutput');

        setDevices({ audioInputs, videoInputs, audioOutputs });

        if (audioInputs.length > 0 && !selectedAudioInput) {
          setSelectedAudioInput(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoInput) {
          setSelectedVideoInput(videoInputs[0].deviceId);
        }
        if (audioOutputs.length > 0 && !selectedAudioOutput) {
          setSelectedAudioOutput(audioOutputs[0].deviceId);
        }
      } catch (err) {
        console.warn('Device enumeration failed', err);
      }
    }

    loadDevices();
    navigator.mediaDevices?.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadDevices);
    };
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  // 2. Camera Preview toggle
  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);
    } else {
      try {
        const constraints = {
          video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch {
        toast.error('Unable to access camera device. Check permissions.');
      }
    }
  };

  // 3. Microphone Level Visualizer
  const toggleMicTest = async () => {
    if (micTesting) {
      cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      setMicTesting(false);
      setVolumeLevel(0);
    } else {
      try {
        const constraints = {
          audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        micStreamRef.current = stream;

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
        setMicTesting(true);
      } catch {
        toast.error('Unable to access microphone. Check browser permissions.');
      }
    }
  };

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="sam-settings-section" aria-label="Audio and video device settings">
      <div className="sam-settings-section__header">
        <h3 className="sam-settings-section__title">Audio & Video Devices</h3>
        <p className="sam-settings-section__desc">
          Test camera streams, calibrate microphone input levels, and choose output devices.
        </p>
      </div>

      <div className="sam-settings-grid-2">
        {/* Camera Settings & Preview */}
        <div className="sam-settings-card">
          <h4 className="sam-settings-card__title">Camera Settings</h4>

          <div className="sam-settings-form__group">
            <label htmlFor="settings-camera-select" className="sam-settings-label">
              Select Camera Device
            </label>
            <select
              id="settings-camera-select"
              className="sam-settings-select"
              value={selectedVideoInput}
              onChange={(e) => setSelectedVideoInput(e.target.value)}
            >
              {devices.videoInputs.length === 0 ? (
                <option value="">Default System Camera</option>
              ) : (
                devices.videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera (${d.deviceId.slice(0, 8)}…)`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Camera Preview Box */}
          <div className="sam-settings-camera-preview">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`sam-settings-camera-video ${cameraActive ? 'sam-settings-camera-video--live' : ''}`}
            />
            {!cameraActive && (
              <div className="sam-settings-camera-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748B' }}>
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <span>Camera preview is inactive</span>
              </div>
            )}
          </div>

          <Button
            variant={cameraActive ? 'danger' : 'outline'}
            size="sm"
            onClick={toggleCamera}
          >
            {cameraActive ? 'Stop Camera Preview' : 'Test Camera Preview'}
          </Button>
        </div>

        {/* Microphone & Audio Settings */}
        <div className="sam-settings-card">
          <h4 className="sam-settings-card__title">Microphone & Audio</h4>

          <div className="sam-settings-form__group">
            <label htmlFor="settings-mic-select" className="sam-settings-label">
              Microphone Input
            </label>
            <select
              id="settings-mic-select"
              className="sam-settings-select"
              value={selectedAudioInput}
              onChange={(e) => setSelectedAudioInput(e.target.value)}
            >
              {devices.audioInputs.length === 0 ? (
                <option value="">Default System Microphone</option>
              ) : (
                devices.audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Audio Input Level Meter */}
          <div className="sam-settings-form__group">
            <label className="sam-settings-label">Microphone Activity Level</label>
            <div className="sam-settings-audio-meter">
              <div
                className="sam-settings-audio-meter__fill"
                style={{ width: `${micTesting ? volumeLevel : 0}%` }}
              />
            </div>
            <span className="sam-settings-hint">
              {micTesting ? `Input Volume: ${volumeLevel}%` : 'Click "Test Microphone" to test audio input levels.'}
            </span>
          </div>

          <div className="sam-settings-form__actions">
            <Button
              variant={micTesting ? 'danger' : 'outline'}
              size="sm"
              onClick={toggleMicTest}
            >
              {micTesting ? 'Stop Mic Test' : 'Test Microphone'}
            </Button>
          </div>

          {/* Output Speaker Selection */}
          <div className="sam-settings-form__group" style={{ marginTop: '16px' }}>
            <label htmlFor="settings-speaker-select" className="sam-settings-label">
              Audio Output Speaker
            </label>
            <select
              id="settings-speaker-select"
              className="sam-settings-select"
              value={selectedAudioOutput}
              onChange={(e) => setSelectedAudioOutput(e.target.value)}
            >
              {devices.audioOutputs.length === 0 ? (
                <option value="">Default System Speaker</option>
              ) : (
                devices.audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker (${d.deviceId.slice(0, 8)}…)`}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioVideoSettings;
