import { UuidUtil } from '../uuid.util';

describe('UuidUtil', () => {
  describe('generate', () => {
    it('should generate a valid UUID v4', () => {
      const uuid = UuidUtil.generate();
      expect(UuidUtil.isValid(uuid)).toBe(true);
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set(Array.from({ length: 100 }, () => UuidUtil.generate()));
      expect(uuids.size).toBe(100);
    });
  });

  describe('isValid', () => {
    it('should validate correct UUID v4', () => {
      expect(UuidUtil.isValid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid strings', () => {
      expect(UuidUtil.isValid('not-a-uuid')).toBe(false);
      expect(UuidUtil.isValid('')).toBe(false);
      expect(UuidUtil.isValid('123')).toBe(false);
    });
  });
});
