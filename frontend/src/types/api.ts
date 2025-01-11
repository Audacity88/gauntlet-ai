import { z } from 'zod';
import { baseMessageSchema, userSchema, channelSchema, messageAttachmentSchema } from './models';

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// Generic paginated response
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

// API Response schemas
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    status: z.number().int()
  });

export const paginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  apiResponseSchema(z.array(dataSchema)).extend({
    page: z.number().int().min(1),
    per_page: z.number().int().min(1),
    total: z.number().int().min(0),
    has_more: z.boolean()
  });

// Specific API response types
export type MessageResponse = ApiResponse<z.infer<typeof baseMessageSchema>>;
export type MessagesResponse = PaginatedResponse<z.infer<typeof baseMessageSchema>>;
export type UserResponse = ApiResponse<z.infer<typeof userSchema>>;
export type UsersResponse = PaginatedResponse<z.infer<typeof userSchema>>;
export type ChannelResponse = ApiResponse<z.infer<typeof channelSchema>>;
export type ChannelsResponse = PaginatedResponse<z.infer<typeof channelSchema>>;
export type AttachmentResponse = ApiResponse<z.infer<typeof messageAttachmentSchema>>;
export type AttachmentsResponse = PaginatedResponse<z.infer<typeof messageAttachmentSchema>>;

// Specific API response schemas
export const messageResponseSchema = apiResponseSchema(baseMessageSchema);
export const messagesResponseSchema = paginatedResponseSchema(baseMessageSchema);
export const userResponseSchema = apiResponseSchema(userSchema);
export const usersResponseSchema = paginatedResponseSchema(userSchema);
export const channelResponseSchema = apiResponseSchema(channelSchema);
export const channelsResponseSchema = paginatedResponseSchema(channelSchema);
export const attachmentResponseSchema = apiResponseSchema(messageAttachmentSchema);
export const attachmentsResponseSchema = paginatedResponseSchema(messageAttachmentSchema);

// Type guards
export const isApiResponse = <T extends z.ZodType>(
  value: unknown,
  schema: T
): value is ApiResponse<z.infer<T>> => {
  return apiResponseSchema(schema).safeParse(value).success;
};

export const isPaginatedResponse = <T extends z.ZodType>(
  value: unknown,
  schema: T
): value is PaginatedResponse<z.infer<T>> => {
  return paginatedResponseSchema(schema).safeParse(value).success;
}; 