// ABOUTME: Tests for the reusable Barcode component (Code 128 via JsBarcode)
// ABOUTME: Verifies SVG bar rendering and graceful empty/invalid/no-canvas handling

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Barcode } from '@client/components/common/Barcode';

describe('Barcode', () => {
  // Note: jsdom has no canvas, so JsBarcode's human-readable text line
  // (which needs canvas.measureText) can't render here. Bars are asserted
  // with displayValue={false}; the text-line is verified in a real browser.

  it('renders an svg containing barcode bars for a valid value', () => {
    const { container } = render(<Barcode value="MEM1234567" displayValue={false} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // JsBarcode draws each bar as a <rect> element inside the svg
    expect(svg!.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('renders without a human-readable text line when displayValue is off', () => {
    const { container } = render(<Barcode value="DVD.42.001" displayValue={false} />);
    expect(container.querySelector('svg text')).toBeNull();
  });

  it('does not throw with default props (displayValue on) even without canvas', () => {
    // Real browsers render the text line; jsdom lacks canvas, so JsBarcode's
    // text measurement throws. The component's guard must swallow it and keep
    // the app alive. jsdom routes that expected failure to console.error, so we
    // capture it here to keep test output pristine, then assert it was raised.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Barcode value="DVD.42.001" />)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toMatch(/getContext/);
    errorSpy.mockRestore();
  });

  it('renders an empty string without throwing', () => {
    expect(() => render(<Barcode value="" />)).not.toThrow();
  });

  it('renders without bars for an empty value', () => {
    const { container } = render(<Barcode value="" />);
    expect(container.querySelectorAll('rect').length).toBe(0);
  });
});
