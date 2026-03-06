// ABOUTME: Tests for the rental confirmation modal
// ABOUTME: Validates line items display, total, and completion callback

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationModal } from '../../../../client/src/components/pos/ConfirmationModal';
import type { LineItem } from '../../../../client/src/components/pos/TransactionPanel';

const lineItems: LineItem[] = [
  { type: 'rental', description: 'The Matrix (DVD) - 3 Day', amount: 499 },
  { type: 'rental', description: 'Blade Runner (Blu-ray) - 7 Day', amount: 699 },
];

const defaultProps = {
  lineItems,
  total: 1306,
  tax: 108,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  processing: false,
};

describe('ConfirmationModal', () => {
  it('displays line items with descriptions and amounts', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText('The Matrix (DVD) - 3 Day')).toBeDefined();
    expect(screen.getByText('$4.99')).toBeDefined();
    expect(screen.getByText('Blade Runner (Blu-ray) - 7 Day')).toBeDefined();
    expect(screen.getByText('$6.99')).toBeDefined();
  });

  it('displays total to ring up in Lightspeed, hides tax row when tax is zero', () => {
    render(<ConfirmationModal {...defaultProps} tax={0} total={1198} />);
    // tax row hidden when zero
    expect(screen.queryByText('Tax')).toBeNull();
    // total = subtotal when no tax
    expect(screen.getByText('$11.98')).toBeDefined();
  });

  it('shows tax row when tax is non-zero', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText('$1.08')).toBeDefined();
    expect(screen.getByText('$13.06')).toBeDefined();
  });

  it('calls onConfirm when Complete Rental is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Complete Rental'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmationModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
