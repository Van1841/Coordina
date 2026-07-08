// ============================================================
// sql/migrate.js
// Applies schema.sql against MYSQL_DATABASE. Run with:
//   npm run migrate
//   node sql/migrate.js --fresh   (drops + recreates all tables)
// ============================================================
// import fs from 'node:fs';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import mysql from 'mysql2/promise';
// import 'dotenv/config';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const fresh = process.argv.includes('--fresh');

// async function main() {
//   const connection = await mysql.createConnection({
//     host: process.env.MYSQL_HOST || '127.0.0.1',
//     port: Number(process.env.MYSQL_PORT || 3306),
//     user: process.env.MYSQL_USER || 'root',
//     password: process.env.MYSQL_PASSWORD || '',
//     multipleStatements: true,
//   });

//   if (fresh) {
//     console.log('[migrate] --fresh: dropping database if it exists...');
//     await connection.query(`DROP DATABASE IF EXISTS ${process.env.MYSQL_DATABASE || 'coordina'}`);
//   }

//   const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
//   console.log('[migrate] applying schema.sql...');
//   await connection.query(schema);
//   console.log('[migrate] done.');
//   await connection.end();
// }

// main().catch((err) => {
//   console.error('[migrate] failed:', err.message);
//   process.exit(1);
// });



// ============================================================
// sql/migrate.js
// Applies schema.sql against MYSQL_DATABASE. Run with:
//   npm run migrate
//   node sql/migrate.js --fresh   (drops + recreates all tables)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fresh = process.argv.includes('--fresh');

const TABLES_IN_DROP_ORDER = ['recommendations', 'incidents', 'resources', 'organizations'];

async function main() {
  const database = process.env.MYSQL_DATABASE || 'coordina';
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database,
    multipleStatements: true,
  });

  if (fresh) {
    console.log('[migrate] --fresh: dropping existing tables (if any)...');
    await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of TABLES_IN_DROP_ORDER) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
    }
    await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log(`[migrate] applying schema.sql to database '${database}'...`);
  await connection.query(schema);
  console.log('[migrate] done.');
  await connection.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});