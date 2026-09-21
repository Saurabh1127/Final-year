import React from 'react';
import './Divider.css';

/**
 * Samvada Divider Component
 * Horizontal or vertical rule with optional text label and alignment.
 */
export function Divider({
  label = '',
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  align = 'center', // 'left' | 'center' | 'right'
  className = '',
  ...props
}) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`sam-divider sam-divider--vertical ${className}`.trim()}
        {...props}
      />
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`sam-divider sam-divider--horizontal sam-divider--align-${align} ${className}`.trim()}
      {...props}
    >
      {label && <span className="sam-divider__label">{label}</span>}
    </div>
  );
}

export default Divider;
