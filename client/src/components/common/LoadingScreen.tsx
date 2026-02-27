// ABOUTME: Full-screen CRT boot splash screen shown when the app first loads
// ABOUTME: Displays the large ASCII logo with a progressive boot sequence animation

import { type CSSProperties, useEffect, useState } from 'react';
import { AsciiDisplay, LOGO_LARGE } from './AsciiArt';

const BOOT_LINES = [
  { text: '> INITIALIZING SYSTEM...', delay: 300 },
  { text: '> LOADING DATABASE......... OK', delay: 400 },
  { text: '> CHECKING INVENTORY....... OK', delay: 350 },
  { text: '> SCANNING BARCODES........ OK', delay: 300 },
  { text: '> STARTING reRun v0.1.0... OK', delay: 400 },
  { text: '> READY.', delay: 200 },
];

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink the cursor
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => clearInterval(blinkInterval);
  }, []);

  // Reveal boot lines one at a time
  useEffect(() => {
    if (visibleLines >= BOOT_LINES.length) {
      const completeTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(completeTimer);
    }

    const delay = visibleLines === 0
      ? 800 // Initial pause after logo appears
      : BOOT_LINES[visibleLines - 1].delay;

    const timer = setTimeout(() => {
      setVisibleLines((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleLines, onComplete]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <AsciiDisplay art={LOGO_LARGE} glow fontSize="var(--font-size-sm)" />

        <div style={styles.bootSequence}>
          {BOOT_LINES.slice(0, visibleLines).map((line, index) => (
            <div key={index} style={styles.bootLine}>
              {line.text}
            </div>
          ))}
          <span style={{
            ...styles.cursor,
            opacity: cursorVisible ? 1 : 0,
          }}>
            █
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    zIndex: 9999,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  bootSequence: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-md)',
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    lineHeight: 1.6,
    minHeight: '160px',
    width: '360px',
  },
  bootLine: {
    whiteSpace: 'pre',
  },
  cursor: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    transition: 'opacity 0.1s',
  },
};
