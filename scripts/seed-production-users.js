#!/usr/bin/env node
/**
 * Idempotent Production User & Master Data Seeder
 *
 * Sets up the 6 canonical role accounts with secure bcrypt-hashed passwords
 * and must_change_password = true.
 *
 * Plaintext passwords are ONLY written to the git-ignored local file:
 *   docs/prod_credentials.local.md
 * Never logged to stdout, stderr, or committed to git.
 */

import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pg = require('../server/node_modules/pg');
const bcrypt = require('../server/node_modules/bcrypt');
const dotenv = require('../server/node_modules/dotenv');

// Load environment from root or server
const rootEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server/.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
else if (fs.existsSync(serverEnvPath)) dotenv.config({ path: serverEnvPath });
else dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
  max: 2,
  connectionTimeoutMillis: 5000,
});

function generateSecurePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+~=';
  const all = upper + lower + digits + symbols;

  const randChar = (set) => set[crypto.randomInt(0, set.length)];
  const chars = [
    randChar(upper),
    randChar(lower),
    randChar(digits),
    randChar(symbols),
  ];

  for (let i = 0; i < 14; i++) {
    chars.push(randChar(all));
  }

  // Shuffle
  return chars.sort(() => 0.5 - Math.random()).join('');
}

const ROLES_TO_SEED = [
  {
    role: 'ADMIN',
    name: 'Municipal Administrator',
    email: process.env.PROD_ADMIN_EMAIL || 'admin@wastejourney.local',
    password: process.env.PROD_ADMIN_PASSWORD || generateSecurePassword(),
  },
  {
    role: 'COLLECTION',
    name: 'Ward Collection Officer',
    email: process.env.PROD_COLLECTION_EMAIL || 'collection@wastejourney.local',
    password: process.env.PROD_COLLECTION_PASSWORD || generateSecurePassword(),
  },
  {
    role: 'TRANSPORTATION',
    name: 'Transit Logistics Officer',
    email: process.env.PROD_TRANSPORT_EMAIL || 'transport@wastejourney.local',
    password: process.env.PROD_TRANSPORT_PASSWORD || generateSecurePassword(),
  },
  {
    role: 'RTS',
    name: 'Transfer Station Weighmaster',
    email: process.env.PROD_RTS_EMAIL || 'rts@wastejourney.local',
    password: process.env.PROD_RTS_PASSWORD || generateSecurePassword(),
  },
  {
    role: 'PROCESSING',
    name: 'Facility Operations Officer',
    email: process.env.PROD_PROCESSING_EMAIL || 'processing@wastejourney.local',
    password: process.env.PROD_PROCESSING_PASSWORD || generateSecurePassword(),
  },
  {
    role: 'HEAD_OFFICER',
    name: 'Chief Environmental Officer',
    email: process.env.PROD_HEADOFFICER_EMAIL || 'headofficer@wastejourney.local',
    password: process.env.PROD_HEADOFFICER_PASSWORD || generateSecurePassword(),
  },
];

const DEFAULT_PROCESS_TYPES = [
  'Composting',
  'Recycling / MRF',
  'Bio-methanation / Biogas',
  'Refuse Derived Fuel (RDF)',
  'Engineered Landfill',
  'Incineration / Waste to Energy',
];

const DEFAULT_WASTE_CATEGORIES = [
  'Wet Waste (Organic)',
  'Dry Waste (Recyclable)',
  'Domestic Hazardous Waste',
  'Sanitary Waste',
  'E-Waste',
  'Construction & Demolition',
];

async function seed() {
  const client = await pool.connect();
  const credentialsOut = [];

  try {
    await client.query('BEGIN');

    // 1. Ensure master data defaults
    for (const pt of DEFAULT_PROCESS_TYPES) {
      await client.query(
        'INSERT INTO process_types (name, is_active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING;',
        [pt]
      );
    }

    for (const wc of DEFAULT_WASTE_CATEGORIES) {
      await client.query(
        'INSERT INTO waste_categories (name, is_active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING;',
        [wc]
      );
    }

    // 2. Ensure app settings default
    await client.query(
      `INSERT INTO app_settings (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING;`,
      [
        'rts_variance_threshold_percent',
        '10.0',
        'Percentage threshold (±) for flagging weight discrepancies between Transport gross and RTS arrival gross mass',
      ]
    );

    // 3. Seed users
    for (const user of ROLES_TO_SEED) {
      const hash = await bcrypt.hash(user.password, 12);
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, true, true)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role;`,
        [user.name, user.email, hash, user.role]
      );

      if (res.rows.length > 0) {
        credentialsOut.push({
          role: user.role,
          name: user.name,
          email: user.email,
          password: user.password,
          status: 'Created (temporary password, change required on first login)',
        });
      } else {
        credentialsOut.push({
          role: user.role,
          name: user.name,
          email: user.email,
          password: '[REDACTED: User already exists in database]',
          status: 'Existing user preserved (unchanged)',
        });
      }
    }

    await client.query('COMMIT');

    // Write credentials to local git-ignored markdown file
    const docsDir = path.resolve(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const credFilePath = path.join(docsDir, 'prod_credentials.local.md');
    const lines = [
      '# Production User Credentials (LOCAL ONLY — DO NOT COMMIT)',
      '',
      `Generated on: ${new Date().toISOString()}`,
      '',
      '> [!CAUTION]',
      '> This file contains temporary initial passwords. Store them in a password manager and rotate on first login.',
      '> Never commit this file or share it publicly.',
      '',
      '| Role | Name | Email | Initial Password | Status |',
      '|---|---|---|---|---|',
      ...credentialsOut.map(
        (c) => `| ${c.role} | ${c.name} | \`${c.email}\` | \`${c.password}\` | ${c.status} |`
      ),
      '',
    ];

    fs.writeFileSync(credFilePath, lines.join('\n'), { mode: 0o600 });

    console.log('✅ Master data defaults verified.');
    console.log('✅ Production users seeded successfully.');
    console.log(`🔒 Initial credentials written safely to: ${credFilePath}`);
    console.log('ℹ️  Passwords were NOT printed to stdout or git-tracked files.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

