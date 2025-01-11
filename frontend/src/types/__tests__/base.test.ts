import { isUUID, isTimestamp, hasTimestampFields } from '../base';

describe('Base Type Guards', () => {
  describe('isUUID', () => {
    it('validates correct UUIDs', () => {
      expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('')).toBe(false);
      expect(isUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isUUID(123)).toBe(false);
      expect(isUUID(null)).toBe(false);
      expect(isUUID(undefined)).toBe(false);
    });
  });

  describe('isTimestamp', () => {
    it('validates correct ISO timestamps', () => {
      expect(isTimestamp('2024-01-01T00:00:00.000Z')).toBe(true);
      expect(isTimestamp(new Date().toISOString())).toBe(true);
    });

    it('rejects invalid timestamps', () => {
      expect(isTimestamp('not-a-date')).toBe(false);
      expect(isTimestamp('')).toBe(false);
      expect(isTimestamp('2024-13-01')).toBe(false); // invalid month
      expect(isTimestamp(123)).toBe(false);
      expect(isTimestamp(null)).toBe(false);
      expect(isTimestamp(undefined)).toBe(false);
    });
  });

  describe('hasTimestampFields', () => {
    it('validates objects with correct timestamp fields', () => {
      const validObject = {
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      expect(hasTimestampFields(validObject)).toBe(true);

      const validObjectWithInserted = {
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        inserted_at: '2024-01-01T00:00:00.000Z'
      };
      expect(hasTimestampFields(validObjectWithInserted)).toBe(true);
    });

    it('rejects objects with missing or invalid timestamp fields', () => {
      expect(hasTimestampFields({})).toBe(false);
      expect(hasTimestampFields({ created_at: 'invalid' })).toBe(false);
      expect(hasTimestampFields({
        created_at: '2024-01-01T00:00:00.000Z'
      })).toBe(false);
      expect(hasTimestampFields({
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: 'invalid'
      })).toBe(false);
      expect(hasTimestampFields(null)).toBe(false);
      expect(hasTimestampFields(undefined)).toBe(false);
    });
  });
}); 