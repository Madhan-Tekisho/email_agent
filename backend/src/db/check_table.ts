import { supabase } from './index';

const checkTable = async () => {
    try {
        console.log("Checking for department_head_history table...");

        const { data, error } = await supabase
            .from('department_head_history')
            .select('*')
            .limit(1);

        if (error) {
            console.log("Check result: Table might not exist or is not accessible.");
            console.log("Error details:", error.message, error.code);
        } else {
            console.log("Table exists and is accessible. Rows found:", data.length);
        }
        process.exit(0);
    } catch (e) {
        console.error("Check failed:", e);
        process.exit(1);
    }
};

checkTable();
