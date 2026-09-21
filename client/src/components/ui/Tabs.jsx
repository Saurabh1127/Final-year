import React from 'react';
import './Tabs.css';

/**
 * Samvada Tabs Navigation Component
 * Supports underline and pill variants with counts, badges, and icons.
 */
export function Tabs({
  tabs = [], // [{ id, label, icon, count, badge, disabled }]
  activeTab,
  onChange,
  variant = 'default', // 'default' | 'pills'
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <div
      role="tablist"
      className={`sam-tabs-list sam-tabs-list--${variant} sam-tabs-list--${size} ${
        fullWidth ? 'sam-tabs-list--full' : ''
      } ${className}`.trim()}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange?.(tab.id)}
            className={`sam-tab-btn ${
              isActive ? 'sam-tab-btn--active' : ''
            } ${tab.disabled ? 'sam-tab-btn--disabled' : ''}`}
          >
            {tab.icon && <span className="sam-tab-icon">{tab.icon}</span>}
            <span className="sam-tab-label">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="sam-tab-count">{tab.count}</span>
            )}
            {tab.badge && <span className="sam-tab-badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
