/**
 * Core type definitions for the application
 */

/**
 * Represents a UUID string
 * @example "123e4567-e89b-12d3-a456-426614174000"
 */
export type UUID = string;

/**
 * Represents an ISO timestamp string
 * @example "2024-01-01T00:00:00.000Z"
 */
export type Timestamp = string;

/**
 * Common timestamp fields used across multiple entities
 */
export interface TimestampFields {
  /** When the entity was created */
  created_at: Timestamp;
  /** When the entity was last updated */
  updated_at: Timestamp;
  /** When the entity was inserted into the database (optional) */
  inserted_at?: Timestamp;
}

/**
 * Common fields for all entities
 */
export interface BaseEntity extends TimestampFields {
  /** Unique identifier */
  id: UUID;
}

/**
 * Type guard to check if a value is a valid UUID
 */
export const isUUID = (value: unknown): value is UUID => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Type guard to check if a value is a valid timestamp
 */
export const isTimestamp = (value: unknown): value is Timestamp => {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

/**
 * Type guard to check if an object has timestamp fields
 */
export const hasTimestampFields = (value: unknown): value is TimestampFields => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    isTimestamp(obj.created_at) &&
    isTimestamp(obj.updated_at) &&
    (obj.inserted_at === undefined || isTimestamp(obj.inserted_at))
  );
}; 