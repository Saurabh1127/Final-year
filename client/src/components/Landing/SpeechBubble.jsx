import React from 'react';

/**
 * SpeechBubble
 * Displays a speech bubble with multilingual text and a language label.
 * Animates in when `active` transitions to true.
 *
 * @param {string}  props.text      - the multilingual greeting
 * @param {string}  props.language  - label text e.g. "Hindi"
 * @param {boolean} props.active    - controls visibility
 * @param {string}  props.color     - accent color matching the region
 * @param {string}  props.direction - 'left' | 'right' (tail direction)
 */
export function SpeechBubble({
  text,
  language,
  active = false,
  color = 'var(--accent)',
  direction = 'left',
}) {
  return (
    <div
      className={`speech-bubble speech-bubble--${direction} ${active ? 'speech-bubble--active' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`${language}: ${text}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="speech-bubble__lang" style={{ color }}>
          {language}
        </span>
      </div>
      <div className="speech-bubble__text font-semibold">{text}</div>
    </div>
  );
}

export default SpeechBubble;
