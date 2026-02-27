// ABOUTME: ASCII art constants and display component for the reRun CRT theme
// ABOUTME: Exports small/large logos, VHS tape art, and a styled pre-tag renderer

import type { CSSProperties } from 'react';

export const LOGO_SMALL = `\
┌────────────────┐
│  ◄◄ reRun ►►  │
│   V·I·D·E·O   │
└────────────────┘`;

export const LOGO_LARGE = `\
╔══════════════════════════════════════════╗
║                                          ║
║     ╦═╗ ╔═╗ ╦═╗ ╦ ╦ ╦╗╦                ║
║     ╠╦╝ ╠╣  ╠╦╝ ║ ║ ║║║                ║
║     ╩╚═ ╚═╝ ╩╚═ ╚═╝ ╩╚╝                ║
║                                          ║
║         ─── VIDEO RENTAL POS ───         ║
║                                          ║
║  ┌─────────────────────────────────────┐ ║
║  │ ○  ┌──────────┐ ┌──────────┐    ○  │ ║
║  │    │ ░░░░░░░░ │ │ ░░░░░░░░ │       │ ║
║  │    └──────────┘ └──────────┘       │ ║
║  │  ◄◄  ▮▮  ►►  ■   BE KIND REWIND   │ ║
║  └─────────────────────────────────────┘ ║
║                                          ║
╚══════════════════════════════════════════╝`;

export const VHS_TAPE = `\
┌─────────────────────────┐
│  ┌─────┐     ┌─────┐   │
│  │ ░░░ │     │ ░░░ │   │
│  └─────┘     └─────┘   │
│    ╰───────────╯        │
└─────────────────────────┘`;

interface AsciiDisplayProps {
  art: string;
  color?: string;
  glow?: boolean;
  fontSize?: string;
}

export function AsciiDisplay({ art, color, glow, fontSize }: AsciiDisplayProps) {
  const style: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    color: color || 'var(--crt-green)',
    textShadow: glow ? 'var(--glow-green)' : 'none',
    lineHeight: 1.2,
    fontSize: fontSize || 'var(--font-size-sm)',
    whiteSpace: 'pre',
    textAlign: 'center',
    margin: 0,
    padding: 0,
    userSelect: 'none',
  };

  return <pre style={style}>{art}</pre>;
}
