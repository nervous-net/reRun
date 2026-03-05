// ABOUTME: Accessibility-focused tests for the Table component
// ABOUTME: Verifies scope attributes, caption, keyboard navigation, and role attributes on clickable rows

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Table } from '@client/components/common/Table';

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'year', label: 'Year' },
  { key: 'format', label: 'Format' },
];

const data = [
  { title: 'Blade Runner', year: '1982', format: 'VHS' },
  { title: 'Aliens', year: '1986', format: 'DVD' },
];

describe('Table', () => {
  it('renders column headers with scope="col"', () => {
    render(<Table columns={columns} data={data} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    headers.forEach((header) => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  it('renders data rows', () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('Blade Runner')).toBeInTheDocument();
    expect(screen.getByText('1982')).toBeInTheDocument();
    expect(screen.getByText('Aliens')).toBeInTheDocument();
    expect(screen.getByText('1986')).toBeInTheDocument();
  });

  it('shows empty message when data is empty', () => {
    render(<Table columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows default empty message when none provided', () => {
    render(<Table columns={columns} data={[]} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders sr-only caption when provided', () => {
    render(<Table columns={columns} data={data} caption="Movie inventory" />);
    const caption = screen.getByText('Movie inventory');
    expect(caption.tagName).toBe('CAPTION');
    expect(caption.className).toBe('sr-only');
  });

  it('clickable rows have tabIndex and role="button"', () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} data={data} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row).toHaveAttribute('tabindex', '0');
    });
  });

  it('clickable rows fire onRowClick on Enter key', () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} data={data} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('button');
    fireEvent.keyDown(rows[0], { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledWith(data[0], 0);
  });

  it('clickable rows fire onRowClick on Space key', () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} data={data} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('button');
    fireEvent.keyDown(rows[1], { key: ' ' });
    expect(onRowClick).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledWith(data[1], 1);
  });

  it('non-clickable rows have no tabIndex or role', () => {
    render(<Table columns={columns} data={data} />);
    // Without onRowClick, rows are plain tr elements (role="row")
    const rows = screen.getAllByRole('row');
    // First row is header, skip it
    const dataRows = rows.slice(1);
    dataRows.forEach((row) => {
      expect(row).not.toHaveAttribute('tabindex');
      expect(row).not.toHaveAttribute('role', 'button');
    });
  });

  it('clickable rows fire onRowClick on click', () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} data={data} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('button');
    fireEvent.click(rows[0]);
    expect(onRowClick).toHaveBeenCalledWith(data[0], 0);
  });
});
