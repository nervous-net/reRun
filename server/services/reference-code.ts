// ABOUTME: Generates short reference codes for tying reRun transactions to Lightspeed
// ABOUTME: Format is RN- followed by 4 uppercase alphanumeric characters (no I or O)

import { customAlphabet } from 'nanoid';

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generate = customAlphabet(ALPHABET, 4);

export function generateReferenceCode(): string {
  return `RN-${generate()}`;
}
