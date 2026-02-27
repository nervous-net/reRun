// ABOUTME: Tests for theme preview pages
// ABOUTME: Validates each route renders with correct theme class and all 10 sections present

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemePreviewPage } from '../../../../client/src/components/themes/ThemePreviewPage';
import { ThemePreview } from '../../../../client/src/components/themes/ThemePreview';

const THEME_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

const SECTION_TEST_IDS = [
  'section-header',
  'section-palette',
  'section-table',
  'section-buttons',
  'section-alerts',
  'section-badges',
  'section-inputs',
  'section-receipt',
  'section-logo',
  'section-statusbar',
];

describe('ThemePreviewPage', () => {
  THEME_IDS.forEach((id) => {
    it(`renders with theme-${id} class for option ${id}`, () => {
      render(
        <MemoryRouter>
          <ThemePreviewPage themeId={id} />
        </MemoryRouter>
      );

      const wrapper = screen.getByTestId('theme-wrapper');
      expect(wrapper.className).toContain(`theme-${id}`);
    });
  });
});

describe('ThemePreview', () => {
  it('renders the theme name in the header', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="a" />
      </MemoryRouter>
    );

    expect(screen.getByText('Borland Turbo Vision')).toBeDefined();
    expect(screen.getByText('Option A')).toBeDefined();
  });

  it('renders all 10 sections', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="a" />
      </MemoryRouter>
    );

    SECTION_TEST_IDS.forEach((testId) => {
      expect(screen.getByTestId(testId)).toBeDefined();
    });
  });

  it('renders sample rental data in the table', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="b" />
      </MemoryRouter>
    );

    expect(screen.getByText('Blade Runner')).toBeDefined();
    expect(screen.getByText('The Terminator')).toBeDefined();
    expect(screen.getByText('Ghostbusters')).toBeDefined();
    expect(screen.getByText('Aliens')).toBeDefined();
    expect(screen.getByText('Back to the Future')).toBeDefined();
  });

  it('renders all four button variants', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="c" />
      </MemoryRouter>
    );

    expect(screen.getByText('Primary')).toBeDefined();
    expect(screen.getByText('Secondary')).toBeDefined();
    expect(screen.getByText('Danger')).toBeDefined();
    expect(screen.getByText('Ghost')).toBeDefined();
  });

  it('renders all four alert types', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="d" />
      </MemoryRouter>
    );

    expect(screen.getByText(/INFO:/)).toBeDefined();
    expect(screen.getByText(/WARNING:/)).toBeDefined();
    expect(screen.getByText(/ERROR:/)).toBeDefined();
    expect(screen.getByText(/SUCCESS:/)).toBeDefined();
  });

  it('renders all four badge types', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="e" />
      </MemoryRouter>
    );

    expect(screen.getByText('IN STOCK')).toBeDefined();
    expect(screen.getByText('LOW STOCK')).toBeDefined();
    // OVERDUE appears in both the table and badges section
    expect(screen.getAllByText('OVERDUE').length).toBeGreaterThanOrEqual(2);
    // RESERVED appears in both the table status and badges section
    expect(screen.getAllByText('RESERVED').length).toBeGreaterThanOrEqual(2);
  });

  it('renders input fields with sample values', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="f" />
      </MemoryRouter>
    );

    expect(screen.getByDisplayValue('Sarah Connor')).toBeDefined();
    expect(screen.getByDisplayValue('MBR-00042')).toBeDefined();
  });

  it('renders the receipt with totals', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="a" />
      </MemoryRouter>
    );

    expect(screen.getByText('reRun Video')).toBeDefined();
    expect(screen.getByText('$9.18')).toBeDefined();
    expect(screen.getByText('TOTAL')).toBeDefined();
  });

  it('renders the function key status bar', () => {
    render(
      <MemoryRouter>
        <ThemePreview themeId="a" />
      </MemoryRouter>
    );

    expect(screen.getByText('F1')).toBeDefined();
    expect(screen.getByText('F6')).toBeDefined();
    expect(screen.getByText('reRun v0.1.0')).toBeDefined();
  });

  THEME_IDS.forEach((id) => {
    it(`renders distinct theme name for option ${id}`, () => {
      render(
        <MemoryRouter>
          <ThemePreview themeId={id} />
        </MemoryRouter>
      );

      expect(screen.getByText(`Option ${id.toUpperCase()}`)).toBeDefined();
    });
  });
});
