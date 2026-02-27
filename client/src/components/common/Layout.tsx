// ABOUTME: Full-screen layout with top bar, sidebar navigation, main content, and status bar
// ABOUTME: CRT-themed shell for all reRun screens with F-key navigation hints

import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AsciiDisplay, LOGO_SMALL } from './AsciiArt';

const NAV_ITEMS = [
  { key: 'F1', label: 'POS', path: '/pos' },
  { key: 'F2', label: 'Customers', path: '/customers' },
  { key: 'F3', label: 'Returns', path: '/returns' },
  { key: 'F4', label: 'Inventory', path: '/inventory' },
  { key: 'F5', label: 'Import', path: '/import' },
  { key: 'F6', label: 'Dashboard', path: '/' },
];

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const time = useCurrentTime();
  const [storeName, setStoreName] = useState('reRun Video');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.data?.store_name) {
          setStoreName(data.data.store_name);
        }
      })
      .catch(() => {}); // Silently fail - use default
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const item = NAV_ITEMS.find((nav) => nav.key === e.key);
      if (item) {
        e.preventDefault();
        navigate(item.path);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>{storeName}</div>
        <div style={styles.clock}>{formattedTime}</div>
        <div style={styles.version}>v0.1.0</div>
      </div>

      {/* Body: Sidebar + Content */}
      <div style={styles.body}>
        <nav style={styles.sidebar}>
          <div style={styles.sidebarLogo}>
            <AsciiDisplay art={LOGO_SMALL} glow fontSize="11px" />
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                }}
              >
                <span style={styles.navKey}>[{item.key}]</span> {item.label}
              </Link>
            );
          })}
          <div style={styles.sidebarSpacer} />
          <Link
            to="/settings"
            style={{
              ...styles.navLink,
              ...(location.pathname === '/settings' ? styles.navLinkActive : {}),
            }}
          >
            <span style={styles.navKey}>[F10]</span> Settings
          </Link>
        </nav>

        <main style={styles.content}>{children}</main>
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span>Powered by reRun v0.1.0</span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  logo: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'bold',
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    letterSpacing: '2px',
  },
  clock: {
    fontSize: 'var(--font-size-md)',
    color: 'var(--crt-amber)',
    textShadow: 'var(--glow-amber)',
  },
  version: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '200px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
    borderRight: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    overflowY: 'auto',
  },
  sidebarLogo: {
    padding: '4px 0 8px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '4px',
    display: 'flex',
    justifyContent: 'center',
  },
  navLink: {
    display: 'block',
    padding: '10px 16px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-md)',
    transition: 'background 0.1s, color 0.1s',
    cursor: 'pointer',
  },
  navLinkActive: {
    color: 'var(--crt-green)',
    background: 'var(--bg-panel)',
    textShadow: 'var(--glow-green)',
    borderLeft: '2px solid var(--crt-green)',
  },
  navKey: {
    fontSize: 'var(--font-size-sm)',
    opacity: 0.7,
    marginRight: '4px',
  },
  sidebarSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    position: 'relative' as const,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 16px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
};
