import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Drawer } from '../ui';
import './AppShell.css';

/**
 * Samvada AppShell Layout Component
 * Unifies authenticated desktop/tablet sidebar and mobile topbar + slide drawer navigation.
 */
export function AppShell({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="sam-app-shell">
      {/* Mobile Topbar */}
      <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

      {/* Desktop / Tablet Sidebar */}
      <Sidebar />

      {/* Mobile Navigation Drawer */}
      <Drawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        position="left"
        size="sm"
        showCloseButton={false}
      >
        <div style={{ margin: '-20px', height: 'calc(100% + 40px)' }}>
          <Sidebar onItemClick={() => setMobileMenuOpen(false)} />
        </div>
      </Drawer>

      {/* Main Content Area */}
      <main id="main-content" className="sam-app-main">
        <div className="sam-app-ambient" aria-hidden="true">
          <div className="sam-app-ambient__glow-1" />
          <div className="sam-app-ambient__glow-2" />
        </div>
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;
