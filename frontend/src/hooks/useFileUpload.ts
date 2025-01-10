import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MessageAttachment } from '../types/schema'

interface UseFileUploadProps {
  chatType?: 'channel' | 'dm'
}

export function useFileUpload({ chatType = 'channel' }: UseFileUploadProps = {}) {
  const uploadFile = useCallback(async (file: File, messageId: string) => {
    try {
      // Generate unique filename to avoid collisions
      const timestamp = new Date().getTime()
      const uniqueFilename = `${timestamp}-${file.name}`
      const filePath = `attachments/${messageId}/${uniqueFilename}`

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        throw uploadError
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath)

      // Create attachment record
      const attachment: Partial<MessageAttachment> = {
        id: `${timestamp}`,
        message_id: messageId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        url: publicUrl
      }

      // Update message with attachment
      const table = chatType === 'dm' ? 'direct_messages' : 'messages'

      // First get the current message
      const { data: currentMessage, error: fetchError } = await supabase
        .from(table)
        .select('*, profile:profiles(*)')
        .eq('id', messageId)
        .single()

      if (fetchError) {
        console.error('Error fetching message:', fetchError)
        throw fetchError
      }

      const existingAttachments = currentMessage?.attachments || []
      const newAttachments = [...existingAttachments, attachment]

      // Update the message
      const { data: updatedMessage, error: updateError } = await supabase
        .rpc(chatType === 'dm' ? 'update_dm_with_attachment' : 'update_message_with_attachment', {
          p_message_id: messageId,
          p_attachments: JSON.stringify(newAttachments)
        })

      if (updateError) {
        console.error('Error updating message with attachment:', updateError)
        throw updateError
      }

      // Return the message with the profile data
      return {
        ...updatedMessage,
        user: currentMessage.profile
      }
    } catch (error) {
      console.error('File upload failed:', error)
      throw error
    }
  }, [chatType])

  return { uploadFile }
} 