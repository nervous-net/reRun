// ABOUTME: Reusable Code 128 barcode component rendering a scannable SVG via JsBarcode
// ABOUTME: Always draws black bars on a white background for scanner/printer contrast on the dark CRT UI

import { type CSSProperties, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  height?: number;
  displayValue?: boolean;
  width?: number;
  className?: string;
}

const containerStyle: CSSProperties = {
  display: 'inline-block',
  background: '#fff',
  padding: 'var(--space-xs)',
  borderRadius: 'var(--border-radius)',
  lineHeight: 0,
};

export function Barcode({
  value,
  height = 50,
  displayValue = true,
  width = 1.5,
  className,
}: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    if (!value) {
      // Clear any previously rendered barcode for an empty value.
      svg.innerHTML = '';
      return;
    }

    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        height,
        width,
        displayValue,
        lineColor: '#000',
        background: '#fff',
        margin: 4,
        fontSize: 12,
      });
    } catch {
      // JsBarcode throws on invalid input — fail gracefully with no bars.
      svg.innerHTML = '';
    }
  }, [value, height, width, displayValue]);

  if (!value) return null;

  return (
    <span style={containerStyle} className={className}>
      <svg ref={svgRef} />
    </span>
  );
}
