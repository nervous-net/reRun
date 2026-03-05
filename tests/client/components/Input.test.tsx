// ABOUTME: Accessibility-focused tests for the Input component
// ABOUTME: Verifies label-input association via htmlFor/id, auto-id generation, and aria attributes

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '@client/components/common/Input';

describe('Input', () => {
  it('renders with label connected via htmlFor', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('generates unique id when none provided', () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    // React useId generates ids like :r0:, :r1:, etc.
    expect(input.id).toBeTruthy();
    expect(input.id.length).toBeGreaterThan(0);
  });

  it('uses provided id prop over auto-generated', () => {
    render(<Input label="Phone" id="phone-input" />);
    const input = screen.getByLabelText('Phone');
    expect(input.id).toBe('phone-input');
  });

  it('fires onChange when typed in', () => {
    const onChange = vi.fn();
    render(<Input label="Search" onChange={onChange} />);
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('adds aria-label from placeholder when no label provided', () => {
    render(<Input placeholder="Type here..." />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Type here...');
  });

  it('does not add aria-label when label is provided', () => {
    render(<Input label="Name" placeholder="Type here..." />);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-label');
  });

  it('shows focus glow on focus', () => {
    render(<Input label="Focus me" />);
    const input = screen.getByLabelText('Focus me');
    fireEvent.focus(input);
    expect(input.style.borderColor).toBe('var(--crt-green)');
    expect(input.style.boxShadow).toBe('var(--glow-green)');
  });

  it('removes focus glow on blur', () => {
    render(<Input label="Blur me" />);
    const input = screen.getByLabelText('Blur me');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(input.style.borderColor).toBe('var(--border-color)');
    expect(input.style.boxShadow).toBe('none');
  });
});
