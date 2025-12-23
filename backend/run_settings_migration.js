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
        const sqlPath = path.join(__dirname, 'src/db/create_settings_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running setup using SQL from:', sqlPath);
        await pool.query(sql);
        console.log('Setup successful: system_settings table created (if not exists)');
    } catch (e) {
        console.error('Setup failed', e);
    } finally {
        await pool.end();
    }
};
run();
