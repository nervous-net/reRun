// ABOUTME: First-run setup script for reRun video rental POS
// ABOUTME: Creates database, seeds defaults, prompts for TMDb API key

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════╗');
  console.log('  ║   reRun Video Rental POS       ║');
  console.log('  ║   First-Time Setup              ║');
  console.log('  ╚═══════════════════════════════╝');
  console.log('');

  // Step 1: Check Node.js version
  const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeVersion < 18) {
    console.error(`Node.js ${nodeVersion} detected. reRun requires Node.js 18 or higher.`);
    process.exit(1);
  }
  console.log(`Node.js ${process.versions.node}`);

  // Step 2: Create data directory
  const dataDir = path.join(rootDir, 'data');
  const backupsDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data/ directory');
  }
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
    console.log('Created data/backups/ directory');
  }

  // Step 3: TMDb API key
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('');
    console.log('TMDb API key is needed for movie metadata enrichment.');
    console.log('Get one free at: https://www.themoviedb.org/settings/api');
    console.log('(Press Enter to skip -- you can add it later)');
    const apiKey = await prompt('TMDb API Key: ');

    const envContent = [
      `TMDB_API_KEY=${apiKey || 'your_tmdb_api_key_here'}`,
      `PORT=1987`,
      `DB_PATH=./data/rerun.db`,
    ].join('\n') + '\n';

    fs.writeFileSync(envPath, envContent);
    console.log('Created .env file');
  } else {
    console.log('.env file already exists');
  }

  // Step 4: Initialize database with schema
  console.log('');
  console.log('Initializing database...');

  // Import and run migrations
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.join(rootDir, 'data', 'rerun.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Read and execute the migration SQL
  const drizzleDir = path.join(rootDir, 'drizzle');
  if (fs.existsSync(drizzleDir)) {
    const sqlFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of sqlFiles) {
      const sql = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
      sqlite.exec(sql);
      console.log(`Applied migration: ${file}`);
    }
  }

  // Step 5: Seed default pricing rules
  const { nanoid } = await import('nanoid');

  const existingRules = sqlite.prepare('SELECT COUNT(*) as count FROM pricing_rules').get() as any;
  if (existingRules.count === 0) {
    const rules = [
      { name: 'New Release - 1 Night', type: 'daily', rate: 499, durationDays: 1, lateFeePerDay: 199 },
      { name: 'New Release - 3 Night', type: 'daily', rate: 599, durationDays: 3, lateFeePerDay: 199 },
      { name: 'Catalog - 3 Night', type: 'daily', rate: 299, durationDays: 3, lateFeePerDay: 99 },
      { name: 'Catalog - 7 Night', type: 'daily', rate: 399, durationDays: 7, lateFeePerDay: 99 },
      { name: 'Weekend Special', type: 'daily', rate: 349, durationDays: 3, lateFeePerDay: 99 },
    ];

    const stmt = sqlite.prepare(
      'INSERT INTO pricing_rules (id, name, type, rate, duration_days, late_fee_per_day, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    );
    for (const rule of rules) {
      stmt.run(nanoid(), rule.name, rule.type, rule.rate, rule.durationDays, rule.lateFeePerDay);
    }
    console.log(`Seeded ${rules.length} default pricing rules`);
  }

  // Step 6: Seed default store settings
  const existingSettings = sqlite.prepare('SELECT COUNT(*) as count FROM store_settings').get() as any;
  if (existingSettings.count === 0) {
    const settings = [
      ['tax_rate', '800'],
      ['store_name', 'Way Cool Video'],
      ['store_address', ''],
      ['store_phone', ''],
      ['receipt_footer', 'Thank you for choosing Way Cool Video!'],
    ];

    const stmt = sqlite.prepare('INSERT INTO store_settings (key, value) VALUES (?, ?)');
    for (const [key, value] of settings) {
      stmt.run(key, value);
    }
    console.log(`Seeded ${settings.length} default store settings`);
  }

  sqlite.close();

  console.log('');
  console.log('  ╔═══════════════════════════════╗');
  console.log('  ║   Setup complete!               ║');
  console.log('  ╠═══════════════════════════════╣');
  console.log('  ║                                 ║');
  console.log('  ║   Development:                  ║');
  console.log('  ║     npm run dev                 ║');
  console.log('  ║                                 ║');
  console.log('  ║   Production:                   ║');
  console.log('  ║     npm run build               ║');
  console.log('  ║     npm start                   ║');
  console.log('  ║                                 ║');
  console.log('  ║   http://localhost:1987          ║');
  console.log('  ╚═══════════════════════════════╝');
  console.log('');
}

main().catch(console.error);
