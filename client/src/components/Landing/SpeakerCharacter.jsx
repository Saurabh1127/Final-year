import React from 'react';

/**
 * Speaker Character Definitions
 * High-quality 3D stylized avatars matching SAMVADA's theme.
 */
const CHARACTERS = {
  India: {
    name: 'Ananya',
    city: 'Mumbai',
    country: 'India',
    lang: 'Hindi',
    flag: '🇮🇳',
    image: '/avatars/india.jpg',
    color: '#ff8c42',
  },
  Japan: {
    name: 'Yuki',
    city: 'Tokyo',
    country: 'Japan',
    lang: 'Japanese',
    flag: '🇯🇵',
    image: '/avatars/japan.jpg',
    color: '#e63946',
  },
  France: {
    name: 'Chloé',
    city: 'Paris',
    country: 'France',
    lang: 'French',
    flag: '🇫🇷',
    image: '/avatars/france.jpg',
    color: '#4e9af1',
  },
};

/**
 * SpeakerCharacter
 * Renders a cute, modern 3D avatar badge with live speaking equalizer
 * and region/language tags matching the theme.
 */
export function SpeakerCharacter({ region, active = false, className = '' }) {
  const char = CHARACTERS[region];
  if (!char) return null;

  return (
    <div
      className={`speaker-character-card flex items-center gap-3 p-2.5 pr-4 rounded-xl transition-all duration-500 transform ${
        active
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 scale-90 translate-y-3 pointer-events-none'
      } bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] shadow-md ${className}`}
      aria-hidden={!active}
    >
      {/* Editorial Avatar Image with subtle border and speaking pulse */}
      <div className="relative shrink-0">
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 shadow-xs transition-transform duration-300"
          style={{ borderColor: char.color }}
        >
          <img
            src={char.image}
            alt={`${char.name} from ${char.city}`}
            className="w-full h-full object-cover select-none"
            loading="eager"
          />
        </div>

        {/* Live Audio Status Indicator Dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[var(--surface)] flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
        </span>
      </div>

      {/* Speaker Identity & Audio Equalizer */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs" role="img" aria-label={char.country}>{char.flag}</span>
          <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
            {char.name}
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--status-success)]/15 text-[var(--status-success)]">
            Live
          </span>
        </div>

        <div className="text-[11px] text-[var(--text-secondary)] font-medium">
          {char.city} · <span style={{ color: char.color }} className="font-medium">{char.lang}</span>
        </div>

        {/* Subtle animated sound equalizer bars */}
        <div className="flex items-center gap-1 mt-1.5">
          <span className="w-1 h-2 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDuration: '0.6s' }} />
          <span className="w-1 h-3.5 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDuration: '0.4s' }} />
          <span className="w-1 h-5 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDuration: '0.7s' }} />
          <span className="w-1 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDuration: '0.5s' }} />
          <span className="text-[10px] text-[var(--text-muted)] ml-1 font-mono">
            AI Voice Sync
          </span>
        </div>
      </div>
    </div>
  );
}

export default SpeakerCharacter;
