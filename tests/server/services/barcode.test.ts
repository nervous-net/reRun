// ABOUTME: Tests for barcode generation service
// ABOUTME: Validates unique barcode format and sequential numbering

import { describe, it, expect } from 'vitest';
import { generateBarcode, generateBarcodes } from '../../../server/services/barcode.js';

describe('generateBarcode', () => {
  it('generates a barcode from format and title ID', () => {
    const barcode = generateBarcode('DVD', 'abc12345', 1);
    expect(barcode).toBe('DVD.abc12345.001');
  });

  it('pads sequence number', () => {
    const barcode = generateBarcode('VHS', 'x1', 1);
    expect(barcode).toBe('VHS.x1.001');
  });

  it('uppercases format prefix', () => {
    const barcode = generateBarcode('dvd', 'abc', 1);
    expect(barcode).toBe('DVD.abc.001');
  });

  it('truncates long format to 3 chars', () => {
    const barcode = generateBarcode('Blu-ray', 'abc', 1);
    expect(barcode).toBe('BLU.abc.001');
  });
});

describe('generateBarcodes', () => {
  it('generates sequential barcodes for multiple copies', () => {
    const barcodes = generateBarcodes('BLU', 'xyz99', 3);
    expect(barcodes).toEqual([
      'BLU.xyz99.001',
      'BLU.xyz99.002',
      'BLU.xyz99.003',
    ]);
  });

  it('generates single barcode for count of 1', () => {
    const barcodes = generateBarcodes('VHS', 'abc', 1);
    expect(barcodes).toEqual(['VHS.abc.001']);
  });
});
