// ABOUTME: Tests for the family member picker shown at POS after customer selection
// ABOUTME: Validates display of members, selection callback, and account holder option

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FamilyMemberPicker } from '../../../../client/src/components/pos/FamilyMemberPicker';

const familyMembers = [
  { id: '1', firstName: 'Junior', lastName: 'Smith', relationship: 'son', birthday: '2010-05-15' },
  { id: '2', firstName: 'Jane', lastName: 'Smith', relationship: 'daughter', birthday: '2008-03-22' },
];

const defaultProps = {
  customerName: 'John Smith',
  familyMembers,
  onSelect: vi.fn(),
};

describe('FamilyMemberPicker', () => {
  it('shows account holder option with customer name', () => {
    render(<FamilyMemberPicker {...defaultProps} />);
    expect(screen.getByText(/John Smith/)).toBeDefined();
    expect(screen.getByText(/Account Holder/)).toBeDefined();
  });

  it('shows all family members with names and relationships', () => {
    render(<FamilyMemberPicker {...defaultProps} />);
    expect(screen.getByText(/Junior Smith/)).toBeDefined();
    expect(screen.getByText(/son/)).toBeDefined();
    expect(screen.getByText(/Jane Smith/)).toBeDefined();
    expect(screen.getByText(/daughter/)).toBeDefined();
  });

  it('calls onSelect with null when account holder chosen', () => {
    const onSelect = vi.fn();
    render(<FamilyMemberPicker {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/Account Holder/));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with the family member object when member chosen', () => {
    const onSelect = vi.fn();
    render(<FamilyMemberPicker {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/Junior Smith/));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(familyMembers[0]);
  });
});
