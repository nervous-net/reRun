// ABOUTME: Text component with CRT phosphor glow effect
// ABOUTME: Supports green, amber, and red color variants

import type { ReactNode, ElementType } from 'react';

interface GlowTextProps {
  children: ReactNode;
  variant?: 'green' | 'amber' | 'red';
  as?: ElementType;
  className?: string;
}

export function GlowText({ children, variant = 'green', as: Tag = 'span', className = '' }: GlowTextProps) {
  const variantClass = variant === 'green' ? 'glow-text' : `glow-text glow-text--${variant}`;
  return <Tag className={`${variantClass} ${className}`}>{children}</Tag>;
}
