// ABOUTME: Standalone scanline overlay for layering on any element
// ABOUTME: Pure CSS effect using repeating-linear-gradient

export function Scanlines() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}
