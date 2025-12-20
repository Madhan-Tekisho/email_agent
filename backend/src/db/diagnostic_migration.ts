
import { query } from '../db';

const runDiagnosticMigration = async () => {
    try {
        console.log("Diagnostic Migration Start");

        // Check Pre-existence
        const preCheck = await query("SELECT to_regclass('public.department_head_history') as reg;");
        console.log("Pre-existence check:", preCheck.rows[0].reg);

        console.log("Attempting CREATE TABLE...");
        await query(`
      CREATE TABLE IF NOT EXISTS public.department_head_history (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        department_id uuid NOT NULL,
        head_name character varying NOT NULL,
        head_email character varying NOT NULL,
        start_date timestamp with time zone,
        end_date timestamp with time zone,
        created_at timestamp with time zone DEFAULT now(),
        CONSTRAINT department_head_history_pkey PRIMARY KEY (id),
        CONSTRAINT department_head_history_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
      );
    `);

        // Check Post-existence
        const postCheck = await query("SELECT to_regclass('public.department_head_history') as reg;");
        console.log("Post-existence check:", postCheck.rows[0].reg);

        if (postCheck.rows[0].reg) {
            console.log("SUCCESS: Table exists.");
            process.exit(0);
        } else {
            console.error("FAILURE: Table does not exist after creation.");
            process.exit(1);
        }

    } catch (err) {
        console.error("Diagnostic failed:", err);
        process.exit(1);
    }
};

runDiagnosticMigration();
