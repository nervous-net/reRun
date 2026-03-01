// ABOUTME: Barcode generation for rental copies
// ABOUTME: Creates deterministic barcodes in FORMAT.TITLEID.SEQ pattern

export function generateBarcode(format: string, titleId: string, sequence: number): string {
  const prefix = format.toUpperCase().substring(0, 3);
  const seqPad = String(sequence).padStart(3, '0');
  return `${prefix}.${titleId}.${seqPad}`;
}

export function generateBarcodes(format: string, titleId: string, count: number, startSeq = 1): string[] {
  return Array.from({ length: count }, (_, i) => generateBarcode(format, titleId, startSeq + i));
}
