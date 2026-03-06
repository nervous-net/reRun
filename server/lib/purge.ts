// ABOUTME: Purges soft-deleted records (active=0) older than 30 days
// ABOUTME: Called on server startup to clean up deactivated customers and titles

export function purgeInactiveRecords(db: any) {
  const sqlite = db.$client;
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let customersPurged = 0;
  let titlesPurged = 0;

  // Purge inactive customers with no referencing records
  const inactiveCustomers = sqlite.prepare(`
    SELECT id FROM customers
    WHERE active = 0 AND updated_at <= ?
  `).all(cutoff) as { id: string }[];

  for (const { id } of inactiveCustomers) {
    const hasRentals = sqlite.prepare(
      `SELECT 1 FROM rentals WHERE customer_id = ? LIMIT 1`
    ).get(id);
    const hasTransactions = sqlite.prepare(
      `SELECT 1 FROM transactions WHERE customer_id = ? LIMIT 1`
    ).get(id);
    const hasReservations = sqlite.prepare(
      `SELECT 1 FROM reservations WHERE customer_id = ? LIMIT 1`
    ).get(id);

    if (!hasRentals && !hasTransactions && !hasReservations) {
      sqlite.prepare(`DELETE FROM family_members WHERE customer_id = ?`).run(id);
      sqlite.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
      customersPurged++;
    }
  }

  // Purge inactive titles with no copies that have referencing rentals
  const inactiveTitles = sqlite.prepare(`
    SELECT id FROM titles
    WHERE active = 0 AND updated_at <= ?
  `).all(cutoff) as { id: string }[];

  for (const { id } of inactiveTitles) {
    const hasRentals = sqlite.prepare(`
      SELECT 1 FROM rentals r
      JOIN copies c ON r.copy_id = c.id
      WHERE c.title_id = ? LIMIT 1
    `).get(id);

    if (!hasRentals) {
      sqlite.prepare(`DELETE FROM copies WHERE title_id = ?`).run(id);
      sqlite.prepare(`DELETE FROM titles WHERE id = ?`).run(id);
      titlesPurged++;
    }
  }

  if (customersPurged > 0 || titlesPurged > 0) {
    console.log(`Purged ${customersPurged} customer(s) and ${titlesPurged} title(s) inactive >30 days`);
  }
}
