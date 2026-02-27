// ABOUTME: CRT monitor wrapper component that applies retro visual effects
// ABOUTME: Adds scanlines, vignette, and screen curvature to child content

interface CRTScreenProps {
  children: React.ReactNode;
  className?: string;
}

export function CRTScreen({ children, className = '' }: CRTScreenProps) {
  return (
    <div className={`crt-screen ${className}`}>
      {children}
    </div>
  );
}
