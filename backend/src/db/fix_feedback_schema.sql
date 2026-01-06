-- Create Feedback Table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.feedback (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email_id uuid NOT NULL,
    token character varying NOT NULL,
    rating integer,
    comment text,
    status character varying DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feedback_pkey PRIMARY KEY (id),
    CONSTRAINT feedback_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id)
);

-- Ensure status column exists (if table existed but older version)
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'pending';
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS token character varying;
