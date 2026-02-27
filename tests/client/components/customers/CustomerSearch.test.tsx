// ABOUTME: Tests for the Customer Search component
// ABOUTME: Validates search input rendering and basic interaction

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CustomerSearch } from '../../../../client/src/components/customers/CustomerSearch';

describe('CustomerSearch', () => {
  it('renders search input', () => {
    render(<MemoryRouter><CustomerSearch /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/search/i)).toBeDefined();
  });
});
