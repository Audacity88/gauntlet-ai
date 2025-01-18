-- Add parent_id to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE;

-- Add parent_id to direct_messages table
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS messages_parent_id_idx ON public.messages(parent_id);
CREATE INDEX IF NOT EXISTS direct_messages_parent_id_idx ON public.direct_messages(parent_id);

-- Update RLS policies to include parent_id
DROP POLICY IF EXISTS messages_select_policy ON public.messages;
CREATE POLICY messages_select_policy ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = messages.channel_id
      AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS direct_messages_select_policy ON public.direct_messages;
CREATE POLICY direct_messages_select_policy ON public.direct_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_message_members dm
      WHERE dm.channel_id = direct_messages.channel_id
      AND dm.user_id = auth.uid()
    )
  ); 