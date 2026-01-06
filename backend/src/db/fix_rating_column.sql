-- The 'rating' column is currently NOT NULL, which prevents creating pending requests.
-- We must allow it to be NULL until the user actively submits the feedback.

ALTER TABLE public.feedback ALTER COLUMN rating DROP NOT NULL;
