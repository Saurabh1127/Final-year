import React from 'react';
import './Skeleton.css';

/**
 * Samvada Skeleton Component
 * High-performance placeholder element with smooth shimmer gradient.
 */
export function Skeleton({
  variant = 'text', // 'text' | 'circular' | 'rectangular' | 'card'
  width,
  height,
  count = 1,
  className = '',
  style = {},
  ...props
}) {
  const inlineStyle = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...style,
  };

  if (variant === 'card') {
    return (
      <div className={`sam-skeleton--card ${className}`.trim()} style={inlineStyle} {...props}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Skeleton variant="circular" width="40px" height="40px" />
          <div style={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height="16px" />
            <Skeleton variant="text" width="40%" height="12px" />
          </div>
        </div>
        <Skeleton variant="rectangular" height="80px" />
        <Skeleton variant="text" width="80%" />
      </div>
    );
  }

  if (count > 1 && variant === 'text') {
    return (
      <div className="sam-skeleton-stack">
        {Array.from({ length: count }).map((_, idx) => (
          <span
            key={idx}
            className={`sam-skeleton sam-skeleton--text ${className}`.trim()}
            style={inlineStyle}
            aria-hidden="true"
            {...props}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      className={`sam-skeleton sam-skeleton--${variant} ${className}`.trim()}
      style={inlineStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

export default Skeleton;
