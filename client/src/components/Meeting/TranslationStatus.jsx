import React from 'react';

/**
 * TranslationStatus
 * Floating status pill showing when a participant is actively speaking
 * and their audio chunk is being processed through the neural translation pipeline.
 */
export function TranslationStatus({ translatingFor }) {
  if (!translatingFor) return null;

  return (
    <div
      className="sam-translation-status"
      id="translating-indicator"
      role="status"
      aria-live="polite"
    >
      <span className="sam-translation-status__dot" />
      <span>{translatingFor} is translating…</span>
    </div>
  );
}

export default TranslationStatus;
