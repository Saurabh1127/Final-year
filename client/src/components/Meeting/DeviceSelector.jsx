import React, { useState, useEffect } from 'react';

/**
 * DeviceSelector
 * Dropdown selector for available audio/video hardware devices.
 * Uses navigator.mediaDevices.enumerateDevices() and tracks devicechange events.
 */
export function DeviceSelector({
  kind = 'videoinput',
  label = 'Device',
  selectedDeviceId = '',
  onSelectDevice,
  disabled = false,
  icon,
}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadDevices = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setLoading(false);
        return;
      }

      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        if (isCancelled) return;

        const filtered = allDevices
          .filter((d) => d.kind === kind)
          .map((d, index) => {
            let fallbackName = 'Default Device';
            if (kind === 'videoinput') fallbackName = `Camera ${index + 1}`;
            else if (kind === 'audioinput') fallbackName = `Microphone ${index + 1}`;
            else if (kind === 'audiooutput') fallbackName = `Speaker ${index + 1}`;

            return {
              deviceId: d.deviceId,
              label: d.label || fallbackName,
              groupId: d.groupId,
            };
          });

        setDevices(filtered);

        // If no device currently selected, default to the first one
        if (filtered.length > 0 && !selectedDeviceId && onSelectDevice) {
          onSelectDevice(filtered[0].deviceId);
        }
      } catch (err) {
        console.warn(`Failed to enumerate ${kind} devices:`, err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadDevices();

    // Listen for devices connected/disconnected
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => loadDevices();
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        isCancelled = true;
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [kind, selectedDeviceId, onSelectDevice]);

  const defaultIcon =
    kind === 'videoinput' ? (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ) : kind === 'audioinput' ? (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ) : (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    );

  const inputId = `device-select-${kind}`;

  return (
    <div className="sam-device-selector">
      <div className="sam-device-selector__label-row">
        <label htmlFor={inputId} className="sam-device-selector__label">
          <span className="sam-device-selector__icon">{icon || defaultIcon}</span>
          <span>{label}</span>
        </label>
        {devices.length > 0 && (
          <span className="sam-device-selector__count">{devices.length} found</span>
        )}
      </div>

      <div className="sam-device-selector__select-wrap">
        <select
          id={inputId}
          value={selectedDeviceId || ''}
          onChange={(e) => onSelectDevice && onSelectDevice(e.target.value)}
          disabled={disabled || loading || devices.length === 0}
          className="sam-device-selector__select"
        >
          {loading ? (
            <option value="">Detecting devices...</option>
          ) : devices.length === 0 ? (
            <option value="">No {label.toLowerCase()} found</option>
          ) : (
            devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))
          )}
        </select>
        <div className="sam-device-selector__arrow" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default DeviceSelector;
