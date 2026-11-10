import React, { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutShell } from './LayoutShell';
import { DesktopSidebar } from './DesktopSidebar';
import { TopBar } from './TopBar';
import { MobileNavigation } from './MobileNavigation';
import { SessionAutolock } from './SessionAutolock';
import { SecurityToast } from './SecurityToast';
import { OfflineIndicator } from '../pwa/OfflineIndicator';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith('/game/');
  const [securityToast, setSecurityToast] = useState(false);

  // Sidebar collapse state (default collapsed on tablet screen, expanded on large desktop)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zigame_sidebar_collapsed');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false; // Safe fallback, resolved on mount
  });

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1279px)');
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      try {
        const saved = localStorage.getItem('zigame_sidebar_collapsed');
        if (saved === null) {
          setIsSidebarCollapsed(e.matches);
        }
      } catch {}
    };
    
    // Initial check
    handleMediaChange(mql);
    
    if (mql.addEventListener) {
      mql.addEventListener('change', handleMediaChange);
      return () => mql.removeEventListener('change', handleMediaChange);
    } else {
      mql.addListener(handleMediaChange);
      return () => mql.removeListener(handleMediaChange);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('zigame_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut listener ('[' to toggle sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest?.('[role="dialog"]') ||
          target.closest?.('.modal-content')
        )
      ) {
        return; // Jangan toggle sidebar jika pengguna sedang mengetik atau berada di dalam modal/dialog
      }
      if (e.key === '[') {
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const handleLockTriggered = useCallback(() => {
    setSecurityToast(true);
  }, []);

  return (
    <LayoutShell isGamePage={isGamePage}>
      {/* Session Autolock Manager with Throttled Activity */}
      <SessionAutolock onLockTriggered={handleLockTriggered} />

      {/* Security Notification Banner */}
      <SecurityToast visible={securityToast} />

      {/* Desktop/Tablet Sidebar (Left) */}
      {!isGamePage && (
        <DesktopSidebar 
          collapsed={isSidebarCollapsed} 
          onToggleCollapse={toggleSidebar} 
        />
      )}

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col min-h-0 h-[100dvh] relative transition-all duration-200 ease-in-out ${
          isGamePage 
            ? 'pl-0 pb-0' 
            : `${isSidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[208px]'} pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0`
        }`}
      >
        {/* Top Navbar */}
        {!isGamePage && (
          <TopBar 
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
        )}

        {/* Page Content */}
        <main className={`flex-1 overflow-x-hidden ${isGamePage ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (max 5 items) */}
      {!isGamePage && <MobileNavigation />}

      {/* Global PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </LayoutShell>
  );
}
