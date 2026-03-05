// ABOUTME: Modal dialog component with CRT-styled overlay and panel
// ABOUTME: Supports keyboard dismiss (Esc), click-outside-to-close, title, and footer

import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useRef } from 'react';

const focusableSelector =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  backgroundColor: 'var(--overlay-80)',
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
  textShadow: '0 0 10px var(--accent-50)',
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
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusableElements =
          panelRef.current.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      const timer = setTimeout(() => {
        if (panelRef.current) {
          const firstFocusable =
            panelRef.current.querySelector<HTMLElement>(focusableSelector);
          if (firstFocusable) {
            firstFocusable.focus();
          } else {
            panelRef.current.setAttribute('tabindex', '-1');
            panelRef.current.focus();
          }
        }
      }, 0);

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
        previousFocusRef.current?.focus();
      };
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
      <div
        ref={panelRef}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        {...(title ? { 'aria-labelledby': titleId } : {})}
      >
        {title && (
          <div style={headerStyle}>
            <h2 id={titleId} style={titleStyle}>{title}</h2>
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
