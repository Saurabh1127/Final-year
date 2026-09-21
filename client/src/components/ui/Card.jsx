import React from 'react';
import './Card.css';

/**
 * Samvada Card Component
 * Obsidian elevated container with glassmorphism and interactive hover effects.
 */
export function Card({
  children,
  variant = 'surface', // 'surface' | 'elevated' | 'interactive' | 'glass'
  padding = 'md', // 'none' | 'sm' | 'md' | 'lg'
  bordered = true,
  glow = false,
  onClick,
  className = '',
  ...props
}) {
  const isInteractive = variant === 'interactive' || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`sam-card sam-card--${variant} sam-card--p-${padding} ${
        bordered ? 'sam-card--bordered' : ''
      } ${glow ? 'sam-card--glow' : ''} ${
        isInteractive ? 'sam-card--interactive' : ''
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
