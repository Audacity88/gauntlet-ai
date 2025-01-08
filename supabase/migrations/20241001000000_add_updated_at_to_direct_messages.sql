ALTER TABLE public.direct_messages
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(); 