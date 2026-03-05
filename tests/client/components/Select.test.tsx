// ABOUTME: Accessibility-focused tests for the Select component
// ABOUTME: Verifies label-select association via htmlFor/id, option rendering, and auto-id generation

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from '@client/components/common/Select';

const testOptions = [
  { value: '', label: 'Choose one' },
  { value: 'dvd', label: 'DVD' },
  { value: 'vhs', label: 'VHS' },
  { value: 'bluray', label: 'Blu-ray' },
];

describe('Select', () => {
  it('renders with label connected via htmlFor', () => {
    render(<Select label="Format" options={testOptions} />);
    const select = screen.getByLabelText('Format');
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe('SELECT');
  });

  it('renders all options', () => {
    render(<Select label="Format" options={testOptions} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('Choose one');
    expect(options[1]).toHaveTextContent('DVD');
    expect(options[2]).toHaveTextContent('VHS');
    expect(options[3]).toHaveTextContent('Blu-ray');
  });

  it('fires onChange on selection', () => {
    const onChange = vi.fn();
    render(<Select label="Format" options={testOptions} onChange={onChange} />);
    const select = screen.getByLabelText('Format');
    fireEvent.change(select, { target: { value: 'vhs' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('generates unique id when none provided', () => {
    render(<Select label="Format" options={testOptions} />);
    const select = screen.getByLabelText('Format');
    expect(select.id).toBeTruthy();
    expect(select.id.length).toBeGreaterThan(0);
  });

  it('uses provided id prop over auto-generated', () => {
    render(<Select label="Format" options={testOptions} id="fmt-select" />);
    const select = screen.getByLabelText('Format');
    expect(select.id).toBe('fmt-select');
  });

  it('shows focus glow on focus', () => {
    render(<Select label="Format" options={testOptions} />);
    const select = screen.getByLabelText('Format');
    fireEvent.focus(select);
    expect(select.style.borderColor).toBe('var(--crt-green)');
    expect(select.style.boxShadow).toBe('var(--glow-green)');
  });

  it('removes focus glow on blur', () => {
    render(<Select label="Format" options={testOptions} />);
    const select = screen.getByLabelText('Format');
    fireEvent.focus(select);
    fireEvent.blur(select);
    expect(select.style.borderColor).toBe('var(--border-color)');
    expect(select.style.boxShadow).toBe('none');
  });
});
