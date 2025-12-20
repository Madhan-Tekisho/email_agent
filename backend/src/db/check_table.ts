
import { query } from '../db';

const checkTable = async () => {
    try {
        console.log("Checking for department_head_history table...");
        const res = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'department_head_history';
        `);
        console.log("Table exists:", res.rows.length > 0);

        if (res.rows.length > 0) {
            const cols = await query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'department_head_history';
            `);
            console.log("Columns:", cols.rows);
        }
        process.exit(0);
    } catch (e) {
        console.error("Check failed:", e);
        process.exit(1);
    }
};

checkTable();
