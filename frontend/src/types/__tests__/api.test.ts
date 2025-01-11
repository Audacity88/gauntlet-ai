import { z } from 'zod';
import { baseMessageSchema } from '../models';
import {
  apiResponseSchema,
  paginatedResponseSchema,
  messageResponseSchema,
  messagesResponseSchema,
  isApiResponse,
  isPaginatedResponse
} from '../api';

describe('API Response Types', () => {
  const validTimestamps = {
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  const validMessage = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    channel_id: '123e4567-e89b-12d3-a456-426614174001',
    user_id: '123e4567-e89b-12d3-a456-426614174002',
    content: 'Hello, world!',
    ...validTimestamps
  };

  describe('Single Response Schema', () => {
    it('validates successful responses', () => {
      const response = {
        data: validMessage,
        error: null,
        status: 200
      };

      expect(() => messageResponseSchema.parse(response)).not.toThrow();
      expect(isApiResponse(response, baseMessageSchema)).toBe(true);
    });

    it('validates error responses', () => {
      const response = {
        data: null,
        error: 'Not found',
        status: 404
      };

      expect(() => messageResponseSchema.parse(response)).not.toThrow();
      expect(isApiResponse(response, baseMessageSchema)).toBe(true);
    });

    it('rejects invalid responses', () => {
      const invalidResponse = {
        data: validMessage,
        error: null,
        status: 'OK' // should be number
      };

      expect(() => messageResponseSchema.parse(invalidResponse)).toThrow();
      expect(isApiResponse(invalidResponse, baseMessageSchema)).toBe(false);
    });
  });

  describe('Paginated Response Schema', () => {
    it('validates successful paginated responses', () => {
      const response = {
        data: [validMessage],
        error: null,
        status: 200,
        page: 1,
        per_page: 10,
        total: 1,
        has_more: false
      };

      expect(() => messagesResponseSchema.parse(response)).not.toThrow();
      expect(isPaginatedResponse(response, baseMessageSchema)).toBe(true);
    });

    it('validates empty paginated responses', () => {
      const response = {
        data: [],
        error: null,
        status: 200,
        page: 1,
        per_page: 10,
        total: 0,
        has_more: false
      };

      expect(() => messagesResponseSchema.parse(response)).not.toThrow();
      expect(isPaginatedResponse(response, baseMessageSchema)).toBe(true);
    });

    it('rejects invalid paginated responses', () => {
      const invalidResponse = {
        data: [validMessage],
        error: null,
        status: 200,
        page: 0, // should be >= 1
        per_page: 10,
        total: 1,
        has_more: false
      };

      expect(() => messagesResponseSchema.parse(invalidResponse)).toThrow();
      expect(isPaginatedResponse(invalidResponse, baseMessageSchema)).toBe(false);

      const missingFieldsResponse = {
        data: [validMessage],
        error: null,
        status: 200,
        page: 1
        // missing required fields
      };

      expect(() => messagesResponseSchema.parse(missingFieldsResponse)).toThrow();
      expect(isPaginatedResponse(missingFieldsResponse, baseMessageSchema)).toBe(false);
    });
  });

  describe('Generic Schema Creation', () => {
    it('creates valid schemas for any data type', () => {
      const customSchema = apiResponseSchema(z.string());
      const response = {
        data: 'test',
        error: null,
        status: 200
      };

      expect(() => customSchema.parse(response)).not.toThrow();
    });

    it('creates valid paginated schemas for any data type', () => {
      const customSchema = paginatedResponseSchema(z.number());
      const response = {
        data: [1, 2, 3],
        error: null,
        status: 200,
        page: 1,
        per_page: 10,
        total: 3,
        has_more: false
      };

      expect(() => customSchema.parse(response)).not.toThrow();
    });
  });
}); 