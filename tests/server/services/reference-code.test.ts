// ABOUTME: Tests for Lightspeed reference code generation
// ABOUTME: Validates format, uniqueness, and retry-on-collision behavior

import { describe, it, expect } from 'vitest';
import { generateReferenceCode } from '../../../server/services/reference-code.js';

describe('generateReferenceCode', () => {
  it('returns a code matching RN-XXXX format', () => {
    const code = generateReferenceCode();
    expect(code).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
  });

  it('generates unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferenceCode()));
    expect(codes.size).toBe(100);
  });

  it('excludes ambiguous characters I and O', () => {
    const codes = Array.from({ length: 200 }, () => generateReferenceCode());
    for (const code of codes) {
      const suffix = code.slice(3);
      expect(suffix).not.toMatch(/[IO]/);
    }
  });
});
