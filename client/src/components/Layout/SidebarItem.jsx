import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Samvada SidebarItem Component
 * NavLink item with active mint state, badges, and collapsed tooltip support.
 */
export function SidebarItem({
  to,
  label,
  icon,
  badge = null,
  count = null,
  collapsed = false,
  disabled = false,
  onClick,
}) {
  if (disabled) {
    return (
      <div
        className={`sam-sidebar-item sam-sidebar-item--disabled ${
          collapsed ? 'sam-sidebar-item--collapsed' : ''
        }`}
        title={collapsed ? `${label} (Coming Soon)` : undefined}
      >
        <span className="sam-sidebar-item__icon">{icon}</span>
        {!collapsed && (
          <span className="sam-sidebar-item__label-wrap">
            <span className="sam-sidebar-item__label">{label}</span>
            <span className="sam-sidebar-item__badge-soon">Soon</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      onClick={onClick}
      end={to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `sam-sidebar-item ${isActive ? 'sam-sidebar-item--active' : ''} ${
          collapsed ? 'sam-sidebar-item--collapsed' : ''
        }`
      }
    >
      <span className="sam-sidebar-item__icon">{icon}</span>

      {!collapsed && (
        <span className="sam-sidebar-item__label-wrap">
          <span className="sam-sidebar-item__label">{label}</span>
          {count !== null && count !== undefined && (
            <span className="sam-sidebar-item__count">{count}</span>
          )}
          {badge && <span className="sam-sidebar-item__badge">{badge}</span>}
        </span>
      )}
    </NavLink>
  );
}

export default SidebarItem;
