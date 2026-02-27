// ABOUTME: Tests for the Import Wizard component
// ABOUTME: Validates wizard step progression and basic rendering

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImportWizard } from '../../../../client/src/components/import/ImportWizard';

describe('ImportWizard', () => {
  it('renders step 1 (file upload) initially', () => {
    render(
      <MemoryRouter>
        <ImportWizard />
      </MemoryRouter>
    );
    expect(screen.getByText('Upload CSV File')).toBeDefined();
  });

  it('renders the step indicator with all 5 steps', () => {
    render(
      <MemoryRouter>
        <ImportWizard />
      </MemoryRouter>
    );
    expect(screen.getByText('Upload')).toBeDefined();
    expect(screen.getByText('Map Columns')).toBeDefined();
    expect(screen.getByText('Match')).toBeDefined();
    expect(screen.getByText('Review')).toBeDefined();
    expect(screen.getByText('Import')).toBeDefined();
  });

  it('renders the file upload drop zone on step 1', () => {
    render(
      <MemoryRouter>
        <ImportWizard />
      </MemoryRouter>
    );
    expect(screen.getByText(/drag & drop/i)).toBeDefined();
    expect(screen.getByText(/\.csv/i)).toBeDefined();
  });
});
