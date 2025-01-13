-- Drop policies first
DROP POLICY IF EXISTS "Users can view attachments in their DMs" ON public.direct_message_attachments;
DROP POLICY IF EXISTS "Users can add attachments to their DMs" ON public.direct_message_attachments;
DROP POLICY IF EXISTS "Message authors can delete their attachments" ON public.direct_message_attachments;

-- Drop indexes
DROP INDEX IF EXISTS idx_direct_message_attachments_message_id;

-- Drop the table
DROP TABLE IF EXISTS public.direct_message_attachments; 