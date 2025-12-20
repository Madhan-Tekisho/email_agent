
import { query } from '../db';

const runMigration = async () => {
    try {
        console.log("Running migration: Create department_head_history table...");
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
        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
};

runMigration();
