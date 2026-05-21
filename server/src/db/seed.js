// Run once to populate initial data: node src/db/seed.js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './index.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hash = bcrypt.hashSync('password', 10);
    await client.query(
      `INSERT INTO employees (email, password_hash, name, role, department, departments, position, avatar, phone, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (email) DO NOTHING`,
      [
        'sysadmin@bluebayou.com', hash, 'Isaac Joyner', 'sysadmin',
        'Management', ['Management'], 'System Administrator', 'IJ',
        '(225) 555-0099', '2020-01-01',
      ]
    );

    await client.query('COMMIT');
    console.log('✓ Database seeded successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
