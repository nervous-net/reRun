// ABOUTME: Modal dialog component with CRT-styled overlay and panel
// ABOUTME: Supports keyboard dismiss (Esc), click-outside-to-close, title, and footer

import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const panelStyle: CSSProperties = {
  backgroundColor: 'var(--bg-panel)',
  border: '1px solid var(--crt-green)',
  borderRadius: 'var(--border-radius)',
  maxWidth: '600px',
  width: '90%',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--glow-green)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--space-sm) var(--space-md)',
  borderBottom: '1px solid var(--border-color)',
};

const titleStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-lg)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  textShadow: '0 0 10px rgba(51, 255, 0, 0.5)',
  margin: 0,
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-lg)',
  cursor: 'pointer',
  padding: '0 4px',
  fontFamily: 'inherit',
  lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  padding: 'var(--space-md)',
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderTop: '1px solid var(--border-color)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-sm)',
};

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div ref={panelRef} style={panelStyle} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div style={headerStyle}>
            <h2 style={titleStyle}>{title}</h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
              X
            </button>
          </div>
        )}
        <div style={bodyStyle}>{children}</div>
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  );
}
