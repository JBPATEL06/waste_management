#!/usr/bin/env node
/**
 * Safe Batch & Test Data Cleanup Utility
 *
 * Scans for and removes test batches, stage entries, and associated details.
 *
 * SAFETY GUARANTEES:
 * 1. Read-only by default: displays exact row counts without modifying data.
 * 2. Requires the explicit CLI flag `--confirm` to perform deletion.
 * 3. Atomic execution: wraps all deletions in a single transaction with rollback on error.
 * 4. Preserves users, audit logs, and master reference data.
 *
 * Usage:
 *   Dry run (counts only):
 *     node scripts/clean-test-data.js
 *
 *   Execute deletion:
 *     node scripts/clean-test-data.js --confirm
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pg = require('../server/node_modules/pg');
const dotenv = require('../server/node_modules/dotenv');

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

const isConfirmed = process.argv.includes('--confirm');
const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
  max: 2,
  connectionTimeoutMillis: 5000,
});

async function main() {
  const client = await pool.connect();

  try {
    console.log('========================================================');
    console.log('       DATABASE TEST/DEMO BATCH CLEANUP AUDIT           ');
    console.log('========================================================\n');

    // 1. Audit current counts
    const batchCountRes = await client.query('SELECT COUNT(*)::int AS count FROM batches;');
    const assignmentCountRes = await client.query('SELECT COUNT(*)::int AS count FROM batch_assignments;');
    const entryCountRes = await client.query('SELECT COUNT(*)::int AS count FROM stage_entries;');
    const collCountRes = await client.query('SELECT COUNT(*)::int AS count FROM collection_details;');
    const transCountRes = await client.query('SELECT COUNT(*)::int AS count FROM transportation_details;');
    const rtsCountRes = await client.query('SELECT COUNT(*)::int AS count FROM rts_details;');
    const procCountRes = await client.query('SELECT COUNT(*)::int AS count FROM processing_details;');

    const counts = {
      batches: batchCountRes.rows[0].count,
      assignments: assignmentCountRes.rows[0].count,
      stageEntries: entryCountRes.rows[0].count,
      collectionDetails: collCountRes.rows[0].count,
      transportationDetails: transCountRes.rows[0].count,
      rtsDetails: rtsCountRes.rows[0].count,
      processingDetails: procCountRes.rows[0].count,
    };

    console.log('Target Rows Identified for Deletion:');
    console.log(`  - Batches:                  ${counts.batches}`);
    console.log(`  - Batch Assignments:        ${counts.assignments}`);
    console.log(`  - Stage Entries:            ${counts.stageEntries}`);
    console.log(`  - Collection Details:       ${counts.collectionDetails}`);
    console.log(`  - Transportation Details:   ${counts.transportationDetails}`);
    console.log(`  - RTS Details:              ${counts.rtsDetails}`);
    console.log(`  - Processing Details:       ${counts.processingDetails}`);
    console.log('');

    if (counts.batches === 0) {
      console.log('ℹ️  No batches found in database. Nothing to clean.');
      return;
    }

    if (!isConfirmed) {
      console.log('⚠️  DRY RUN MODE: No changes have been made.');
      console.log('To execute deletion of the rows listed above, run:');
      console.log('  node scripts/clean-test-data.js --confirm\n');
      return;
    }

    // 2. Perform deletion inside transaction
    console.log('🗑️  Executing deletion inside atomic transaction...');
    await client.query('BEGIN');

    // Due to ON DELETE CASCADE on foreign keys, deleting batches cascades to details and entries,
    // but explicit deletion ensures clean ordering and safety
    await client.query('DELETE FROM collection_details;');
    await client.query('DELETE FROM transportation_details;');
    await client.query('DELETE FROM rts_details;');
    await client.query('DELETE FROM processing_details;');
    await client.query('DELETE FROM stage_entries;');
    await client.query('DELETE FROM batch_assignments;');
    const delBatchesRes = await client.query('DELETE FROM batches;');

    await client.query('COMMIT');
    console.log(`✅ Successfully deleted ${delBatchesRes.rowCount} batches and all related stage data.`);
    console.log('🔒 Master data, users, and audit logs were preserved.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Cleanup failed, transaction rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

