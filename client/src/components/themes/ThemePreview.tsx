// ABOUTME: Self-contained theme preview showing 10 UI mockup sections
// ABOUTME: All styles use var() references so CSS variable overrides re-theme everything

import type { CSSProperties } from 'react';

interface ThemePreviewProps {
  themeId: string;
}

const THEMES: Record<string, { name: string; inspiration: string; description: string }> = {
  a: {
    name: 'Borland Turbo Vision',
    inspiration: 'Turbo Pascal / Turbo C IDE',
    description: 'Classic IDE: blue frame, grey panels, white/yellow text',
  },
  b: {
    name: 'Norton Commander',
    inspiration: 'Norton Commander / Midnight Commander',
    description: 'File manager: blue panels, cyan highlights, high contrast',
  },
  c: {
    name: 'WordPerfect 5.1',
    inspiration: 'WordPerfect for DOS',
    description: 'Word processor: blue on blue, clean white text, no glow',
  },
  d: {
    name: 'Lotus 1-2-3',
    inspiration: 'Lotus 1-2-3 Spreadsheet',
    description: 'Spreadsheet terminal: black screen, green phosphor text',
  },
  e: {
    name: 'Classic POS Terminal',
    inspiration: 'IBM 4683 / NCR 7052',
    description: 'Retail terminal: dark background, green/cyan data display',
  },
  f: {
    name: 'Hybrid CRT',
    inspiration: 'Custom reRun blend',
    description: 'Custom blend: blue frame, grey panels, green phosphor glow',
  },
};

const CGA_PALETTE = [
  { name: 'Black', hex: '#000000' },
  { name: 'Blue', hex: '#0000AA' },
  { name: 'Green', hex: '#00AA00' },
  { name: 'Cyan', hex: '#00AAAA' },
  { name: 'Red', hex: '#AA0000' },
  { name: 'Magenta', hex: '#AA00AA' },
  { name: 'Brown', hex: '#AA5500' },
  { name: 'Lt Grey', hex: '#AAAAAA' },
  { name: 'Dk Grey', hex: '#555555' },
  { name: 'Hi Blue', hex: '#5555FF' },
  { name: 'Hi Green', hex: '#55FF55' },
  { name: 'Hi Cyan', hex: '#55FFFF' },
  { name: 'Hi Red', hex: '#FF5555' },
  { name: 'Hi Magenta', hex: '#FF55FF' },
  { name: 'Yellow', hex: '#FFFF55' },
  { name: 'White', hex: '#FFFFFF' },
];

const ACTIVE_COLORS: Record<string, string[]> = {
  a: ['#0000AA', '#AAAAAA', '#FFFFFF', '#FFFF55'],
  b: ['#0000AA', '#55FFFF', '#FFFF55', '#FFFFFF'],
  c: ['#0000AA', '#FFFFFF', '#AAAAAA'],
  d: ['#000000', '#00AA00', '#55FF55', '#FFFFFF'],
  e: ['#000000', '#0000AA', '#55FF55', '#55FFFF', '#FFFF55', '#AAAAAA'],
  f: ['#0000AA', '#555555', '#55FF55', '#FFFFFF', '#FFFF55', '#AAAAAA'],
};

const SAMPLE_RENTALS = [
  { title: 'Blade Runner', format: 'VHS', price: '$3.99', status: 'RENTED' },
  { title: 'The Terminator', format: 'DVD', price: '$4.99', status: 'IN' },
  { title: 'Ghostbusters', format: 'VHS', price: '$2.99', status: 'IN' },
  { title: 'Aliens', format: 'LaserDisc', price: '$5.99', status: 'OVERDUE' },
  { title: 'Back to the Future', format: 'VHS', price: '$3.99', status: 'RESERVED' },
];

const RECEIPT_ITEMS = [
  { desc: 'Blade Runner (VHS) - 3 day', amount: '$3.99' },
  { desc: 'Ghostbusters (VHS) - 3 day', amount: '$2.99' },
  { desc: 'Microwave Popcorn', amount: '$1.50' },
];

const LOGO_ART = `\
╔══════════════════════════════════════╗
║                                      ║
║    ╦═╗ ╔═╗ ╦═╗ ╦ ╦ ╦╗╦             ║
║    ╠╦╝ ╠╣  ╠╦╝ ║ ║ ║║║             ║
║    ╩╚═ ╚═╝ ╩╚═ ╚═╝ ╩╚╝             ║
║                                      ║
║        ─── VIDEO RENTAL POS ───      ║
║                                      ║
╚══════════════════════════════════════╝`;

/* ─── Styles ──────────────────────────────────────────────── */

const containerStyle: CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  padding: 'var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
};

const sectionStyle: CSSProperties = {
  backgroundColor: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  padding: 'var(--space-md)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--crt-amber)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: 'var(--space-sm)',
  textShadow: 'var(--glow-amber)',
};

const headerNameStyle: CSSProperties = {
  fontSize: 'var(--font-size-xxl)',
  color: 'var(--crt-green)',
  textShadow: 'var(--glow-green)',
  fontWeight: 'bold',
  letterSpacing: '2px',
  textTransform: 'uppercase',
};

const headerSubStyle: CSSProperties = {
  fontSize: 'var(--font-size-md)',
  color: 'var(--text-secondary)',
  marginTop: 'var(--space-xs)',
};

const headerDescStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--text-muted)',
  marginTop: 'var(--space-xs)',
  fontStyle: 'italic',
};

const optionLabelStyle: CSSProperties = {
  fontSize: 'var(--font-size-xl)',
  color: 'var(--crt-amber)',
  textShadow: 'var(--glow-amber)',
  fontWeight: 'bold',
  marginBottom: 'var(--space-xs)',
};

/* Palette */
const paletteGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 1fr)',
  gap: 'var(--space-xs)',
};

const swatchStyle: CSSProperties = {
  height: '32px',
  borderRadius: 'var(--border-radius)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '9px',
  fontFamily: 'var(--font-mono)',
  border: '1px solid transparent',
};

/* Table */
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-sm)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-xs) var(--space-sm)',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--crt-amber)',
  textTransform: 'uppercase',
  fontSize: 'var(--font-size-sm)',
  letterSpacing: '0.5px',
};

const tdStyle: CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  borderBottom: '1px solid var(--accent-08)',
  color: 'var(--text-primary)',
};

/* Buttons */
const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  flexWrap: 'wrap',
};

const buttonBaseStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
  padding: 'var(--space-xs) var(--space-md)',
  border: '1px solid',
  borderRadius: 'var(--border-radius)',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

/* Alerts */
const alertBaseStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: 'var(--border-radius)',
  borderLeft: '4px solid',
  fontSize: 'var(--font-size-sm)',
};

/* Badges */
const badgeBaseStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 'var(--font-size-sm)',
  padding: '1px 8px',
  borderRadius: '9999px',
  backgroundColor: 'var(--bg-primary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  border: '1px solid',
};

/* Inputs */
const inputLabelStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--crt-amber)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '2px',
};

const inputFieldStyle: CSSProperties = {
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-md)',
  padding: 'var(--space-xs) var(--space-sm)',
  width: '100%',
};

/* Receipt */
const receiptStyle: CSSProperties = {
  fontFamily: "'Courier New', monospace",
  fontSize: 'var(--font-size-sm)',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  padding: 'var(--space-md)',
  lineHeight: 1.5,
  color: 'var(--text-primary)',
  maxWidth: '340px',
};

const receiptHeaderStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--crt-green)',
  textShadow: 'var(--glow-green)',
  fontWeight: 'bold',
  letterSpacing: '2px',
  textTransform: 'uppercase',
};

const receiptSepStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-muted)',
  margin: '4px 0',
};

const receiptRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const receiptTotalStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontWeight: 'bold',
  color: 'var(--crt-green)',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '2px',
  marginTop: '2px',
};

/* Logo */
const logoStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--crt-green)',
  textShadow: 'var(--glow-green)',
  lineHeight: 1.2,
  fontSize: 'var(--font-size-sm)',
  whiteSpace: 'pre',
  textAlign: 'center',
  margin: 0,
  padding: 0,
};

/* Status bar */
const statusBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  padding: 'var(--space-xs) var(--space-sm)',
  fontSize: 'var(--font-size-sm)',
};

const fKeyStyle: CSSProperties = {
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-primary)',
  padding: '0 var(--space-xs)',
  borderRadius: 'var(--border-radius)',
  marginRight: '2px',
  fontSize: 'var(--font-size-sm)',
};

const fKeyLabelStyle: CSSProperties = {
  color: 'var(--crt-amber)',
  marginRight: 'var(--space-sm)',
  fontSize: 'var(--font-size-sm)',
};

/* ─── Helpers ─────────────────────────────────────────────── */

function statusColor(status: string): string {
  switch (status) {
    case 'IN': return 'var(--crt-green)';
    case 'RENTED': return 'var(--crt-cyan)';
    case 'OVERDUE': return 'var(--crt-red)';
    case 'RESERVED': return 'var(--crt-amber)';
    default: return 'var(--text-primary)';
  }
}

/* ─── Component ───────────────────────────────────────────── */

export function ThemePreview({ themeId }: ThemePreviewProps) {
  const theme = THEMES[themeId] || THEMES.f;
  const activeColors = ACTIVE_COLORS[themeId] || [];

  return (
    <div style={containerStyle}>
      {/* 1. Theme name + description header */}
      <div style={sectionStyle} data-testid="section-header">
        <div style={optionLabelStyle}>Option {themeId.toUpperCase()}</div>
        <div style={headerNameStyle}>{theme.name}</div>
        <div style={headerSubStyle}>Inspired by: {theme.inspiration}</div>
        <div style={headerDescStyle}>{theme.description}</div>
      </div>

      {/* 2. CGA 16-color palette swatches */}
      <div style={sectionStyle} data-testid="section-palette">
        <div style={sectionTitleStyle}>CGA 16-Color Palette</div>
        <div style={paletteGridStyle}>
          {CGA_PALETTE.map((color) => {
            const isActive = activeColors.includes(color.hex);
            return (
              <div
                key={color.hex}
                style={{
                  ...swatchStyle,
                  backgroundColor: color.hex,
                  border: isActive ? '2px solid var(--text-primary)' : '1px solid var(--accent-10)',
                  color: ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#555555'].includes(color.hex)
                    ? '#FFFFFF'
                    : '#000000',
                  opacity: isActive ? 1 : 0.4,
                }}
                title={`${color.name} (${color.hex})`}
              >
                {isActive ? color.name : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Sample table */}
      <div style={sectionStyle} data-testid="section-table">
        <div style={sectionTitleStyle}>Rental Inventory</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Format</th>
              <th style={thStyle}>Price</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_RENTALS.map((rental, i) => (
              <tr key={rental.title} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--accent-02)' }}>
                <td style={tdStyle}>{rental.title}</td>
                <td style={tdStyle}>{rental.format}</td>
                <td style={tdStyle}>{rental.price}</td>
                <td style={{ ...tdStyle, color: statusColor(rental.status), fontWeight: 'bold' }}>
                  {rental.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Button row */}
      <div style={sectionStyle} data-testid="section-buttons">
        <div style={sectionTitleStyle}>Buttons</div>
        <div style={buttonRowStyle}>
          <button style={{
            ...buttonBaseStyle,
            backgroundColor: 'transparent',
            color: 'var(--crt-green)',
            borderColor: 'var(--crt-green)',
            boxShadow: 'var(--glow-green)',
          }}>
            Primary
          </button>
          <button style={{
            ...buttonBaseStyle,
            backgroundColor: 'transparent',
            color: 'var(--crt-green-dim)',
            borderColor: 'var(--crt-green-dim)',
          }}>
            Secondary
          </button>
          <button style={{
            ...buttonBaseStyle,
            backgroundColor: 'transparent',
            color: 'var(--crt-red)',
            borderColor: 'var(--crt-red)',
          }}>
            Danger
          </button>
          <button style={{
            ...buttonBaseStyle,
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            borderColor: 'transparent',
          }}>
            Ghost
          </button>
        </div>
      </div>

      {/* 5. Alert samples */}
      <div style={sectionStyle} data-testid="section-alerts">
        <div style={sectionTitleStyle}>Alerts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div style={{ ...alertBaseStyle, color: 'var(--crt-cyan)', borderLeftColor: 'var(--crt-cyan)' }}>
            INFO: New titles added to inventory this week
          </div>
          <div style={{ ...alertBaseStyle, color: 'var(--crt-amber)', borderLeftColor: 'var(--crt-amber)' }}>
            WARNING: 3 rentals overdue by more than 7 days
          </div>
          <div style={{ ...alertBaseStyle, color: 'var(--crt-red)', borderLeftColor: 'var(--crt-red)' }}>
            ERROR: Barcode scanner disconnected
          </div>
          <div style={{ ...alertBaseStyle, color: 'var(--crt-green)', borderLeftColor: 'var(--crt-green)' }}>
            SUCCESS: Backup completed successfully
          </div>
        </div>
      </div>

      {/* 6. Badge samples */}
      <div style={sectionStyle} data-testid="section-badges">
        <div style={sectionTitleStyle}>Badges</div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <span style={{ ...badgeBaseStyle, color: 'var(--crt-green)', borderColor: 'var(--crt-green-dim)' }}>
            IN STOCK
          </span>
          <span style={{ ...badgeBaseStyle, color: 'var(--crt-amber)', borderColor: 'var(--crt-amber-dim)' }}>
            LOW STOCK
          </span>
          <span style={{ ...badgeBaseStyle, color: 'var(--crt-red)', borderColor: 'var(--crt-red)' }}>
            OVERDUE
          </span>
          <span style={{ ...badgeBaseStyle, color: 'var(--crt-cyan)', borderColor: 'var(--crt-cyan)' }}>
            RESERVED
          </span>
        </div>
      </div>

      {/* 7. Input field samples */}
      <div style={sectionStyle} data-testid="section-inputs">
        <div style={sectionTitleStyle}>Form Inputs</div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <div style={{ flex: 1 }}>
            <div style={inputLabelStyle}>Customer Name</div>
            <input
              type="text"
              style={inputFieldStyle}
              defaultValue="Sarah Connor"
              readOnly
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={inputLabelStyle}>Member Barcode</div>
            <input
              type="text"
              style={inputFieldStyle}
              defaultValue="MBR-00042"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* 8. Mini POS receipt mockup */}
      <div style={sectionStyle} data-testid="section-receipt">
        <div style={sectionTitleStyle}>Receipt Preview</div>
        <div style={receiptStyle}>
          <div style={receiptHeaderStyle}>reRun Video</div>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Your Neighborhood Video Store
          </div>
          <div style={receiptSepStyle}>{'='.repeat(36)}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Customer: Sarah Connor
          </div>
          <div style={receiptSepStyle}>{'-'.repeat(36)}</div>
          {RECEIPT_ITEMS.map((item) => (
            <div key={item.desc} style={receiptRowStyle}>
              <span>{item.desc}</span>
              <span>{item.amount}</span>
            </div>
          ))}
          <div style={receiptSepStyle}>{'-'.repeat(36)}</div>
          <div style={receiptRowStyle}>
            <span>Subtotal</span>
            <span>$8.48</span>
          </div>
          <div style={receiptRowStyle}>
            <span>Tax (8.25%)</span>
            <span>$0.70</span>
          </div>
          <div style={receiptTotalStyle}>
            <span>TOTAL</span>
            <span>$9.18</span>
          </div>
          <div style={receiptSepStyle}>{'='.repeat(36)}</div>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Thank you for choosing reRun!
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            BE KIND, REWIND
          </div>
        </div>
      </div>

      {/* 9. ASCII art logo with glow */}
      <div style={sectionStyle} data-testid="section-logo">
        <div style={sectionTitleStyle}>ASCII Logo</div>
        <pre style={logoStyle}>{LOGO_ART}</pre>
      </div>

      {/* 10. Function key status bar footer */}
      <div style={statusBarStyle} data-testid="section-statusbar">
        <div>
          <span style={fKeyStyle}>F1</span><span style={fKeyLabelStyle}>POS</span>
          <span style={fKeyStyle}>F2</span><span style={fKeyLabelStyle}>Customers</span>
          <span style={fKeyStyle}>F3</span><span style={fKeyLabelStyle}>Returns</span>
          <span style={fKeyStyle}>F4</span><span style={fKeyLabelStyle}>Inventory</span>
          <span style={fKeyStyle}>F5</span><span style={fKeyLabelStyle}>Import</span>
          <span style={fKeyStyle}>F6</span><span style={fKeyLabelStyle}>Dashboard</span>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          reRun v0.1.0
        </div>
      </div>
    </div>
  );
}
