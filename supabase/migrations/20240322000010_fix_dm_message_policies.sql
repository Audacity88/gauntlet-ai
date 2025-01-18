-- Drop existing policies
DROP POLICY IF EXISTS "Users can view direct messages they are members of" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages to their channels" ON public.direct_messages;

-- Create unified policies for direct messages
CREATE POLICY "Users can view direct messages they are members of" ON public.direct_messages
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_messages.channel_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send direct messages to their channels" ON public.direct_messages
    FOR INSERT
    WITH CHECK (
        -- Allow messages from the authenticated user
        (user_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_messages.channel_id
            AND user_id = auth.uid()
        ))
        OR
        -- Allow AI responses to the authenticated user
        (EXISTS (
            SELECT 1 FROM public.direct_message_members dm1
            JOIN public.direct_message_members dm2 ON dm2.channel_id = dm1.channel_id
            WHERE dm1.channel_id = direct_messages.channel_id
            AND dm1.user_id = auth.uid()
            AND dm2.user_id = user_id
        ))
    );

-- Ensure RLS is enabled
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT SELECT ON public.direct_message_members TO authenticated; 