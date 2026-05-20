import pg from 'pg';

// Will be used once DATABASE_URL is configured on DigitalOcean
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
