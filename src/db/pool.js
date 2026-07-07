// ============================================================
// src/db/pool.js
// Single shared mysql2 connection pool. Every query in the app
// goes through this pool — nothing opens ad-hoc connections.
//
// PORTABILITY NOTE: query placeholders use mysql2's `?` syntax
// throughout the codebase rather than any MySQL-only SQL
// features (no ON DUPLICATE KEY hacks, no MySQL JSON functions),
// so swapping this file for a `pg` Pool with the same
// `.query(sql, params)` shape is close to a drop-in replacement.
// ============================================================
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('db');

export const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});

export async function query(sql, params = {}) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    log.error('query failed:', err.message, '\n  sql:', sql);
    throw err;
  }
}

export async function pingDatabase() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    log.warn('database ping failed:', err.message);
    return false;
  }
}
