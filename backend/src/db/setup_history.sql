
-- Department Head History Table
CREATE TABLE IF NOT EXISTS public.department_head_history (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL,
    head_name character varying NOT NULL,
    head_email character varying NOT NULL,
    start_date timestamp with time zone DEFAULT now(), -- When they *started* (approximate if inferred)
    end_date timestamp with time zone DEFAULT now(),   -- When they *left* (record created)
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT department_head_history_pkey PRIMARY KEY (id),
    CONSTRAINT department_head_history_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
