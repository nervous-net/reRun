// ABOUTME: Thin route wrapper that applies a theme class and renders the preview
// ABOUTME: Takes a themeId prop to select which CGA color scheme to display

import type { CSSProperties } from 'react';
import { ThemePreview } from './ThemePreview';

interface ThemePreviewPageProps {
  themeId: string;
}

const wrapperStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'auto',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
};

export function ThemePreviewPage({ themeId }: ThemePreviewPageProps) {
  return (
    <div className={`theme-${themeId}`} style={wrapperStyle} data-testid="theme-wrapper">
      <ThemePreview themeId={themeId} />
    </div>
  );
}
