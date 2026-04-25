import { v4 as uuidv4 } from 'uuid';

/**
 * UUID utility for generating unique identifiers.
 */
export class UuidUtil {
  /**
   * Generates a new v4 UUID.
   */
  static generate(): string {
    return uuidv4();
  }

  /**
   * Validates whether a string is a valid UUID v4.
   */
  static isValid(value: string): boolean {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(value);
  }
}
