const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'src/db/setup_history.sql'), 'utf8');
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration successful');
    } catch (e) {
        console.error('Migration failed', e);
    } finally {
        await pool.end();
    }
};
run();
