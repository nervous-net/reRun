// ABOUTME: Tests for the reference code display shown after checkout
// ABOUTME: Validates the code is displayed prominently and Done button works

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceCodeScreen } from '../../../../client/src/components/pos/ReferenceCodeScreen';

describe('ReferenceCodeScreen', () => {
  const defaultProps = {
    referenceCode: 'RN-7X3K',
    total: 1299,
    onDone: vi.fn(),
  };

  it('displays the reference code prominently', () => {
    render(<ReferenceCodeScreen {...defaultProps} />);
    const codeElement = screen.getByText('RN-7X3K');
    expect(codeElement).toBeDefined();
    expect(codeElement.style.userSelect).toBe('all');
    expect(codeElement.style.fontFamily).toContain('var(--font-mono)');
  });

  it('displays the total that was rung up', () => {
    render(<ReferenceCodeScreen {...defaultProps} />);
    expect(screen.getByText('$12.99')).toBeDefined();
  });

  it('calls onDone when Done is clicked', () => {
    const onDone = vi.fn();
    render(<ReferenceCodeScreen {...defaultProps} onDone={onDone} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('displays instruction text mentioning Lightspeed', () => {
    render(<ReferenceCodeScreen {...defaultProps} />);
    expect(screen.getByText(/lightspeed/i)).toBeDefined();
  });
});
