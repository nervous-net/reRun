// ABOUTME: Provides getNow() helper that respects a dev time override from store settings
// ABOUTME: Returns current date or a simulated date for testing time-sensitive features

import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';

export function getNow(db: any): Date {
  try {
    const row = db.select().from(storeSettings).where(eq(storeSettings.key, 'dev_date')).get();
    if (row?.value) {
      const override = new Date(row.value);
      if (!isNaN(override.getTime())) {
        return override;
      }
    }
  } catch {
    // Fall through to real date
  }
  return new Date();
}
