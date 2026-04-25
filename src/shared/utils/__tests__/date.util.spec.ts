import { DateUtil } from '../date.util';

describe('DateUtil', () => {
  describe('nowISO', () => {
    it('should return a valid ISO string', () => {
      const iso = DateUtil.nowISO();
      expect(new Date(iso).toISOString()).toBe(iso);
    });
  });

  describe('nowTimestamp', () => {
    it('should return a valid UNIX timestamp', () => {
      const ts = DateUtil.nowTimestamp();
      expect(typeof ts).toBe('number');
      expect(ts).toBeGreaterThan(0);
    });
  });

  describe('toTimestamp', () => {
    it('should convert ISO to UNIX timestamp', () => {
      const ts = DateUtil.toTimestamp('2026-01-01T00:00:00.000Z');
      expect(typeof ts).toBe('number');
      expect(ts).toBeGreaterThan(0);
    });
  });

  describe('toISO', () => {
    it('should convert UNIX timestamp to ISO string', () => {
      const ts = DateUtil.toTimestamp('2026-01-01T00:00:00.000Z');
      const iso = DateUtil.toISO(ts);
      expect(iso).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('computeDays', () => {
    it('should compute days inclusively', () => {
      expect(DateUtil.computeDays('2026-01-01', '2026-01-01')).toBe(1);
      expect(DateUtil.computeDays('2026-01-01', '2026-01-05')).toBe(5);
      expect(DateUtil.computeDays('2026-01-01', '2026-01-10')).toBe(10);
    });
  });

  describe('isValidDateRange', () => {
    it('should accept valid ranges', () => {
      expect(DateUtil.isValidDateRange('2026-01-01', '2026-01-05')).toBe(true);
      expect(DateUtil.isValidDateRange('2026-01-01', '2026-01-01')).toBe(true);
    });

    it('should reject invalid ranges', () => {
      expect(DateUtil.isValidDateRange('2026-01-05', '2026-01-01')).toBe(false);
    });
  });

  describe('isWithinGracePeriod', () => {
    it('should return true when well before deadline', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(DateUtil.isWithinGracePeriod(futureDate, 24)).toBe(true);
    });

    it('should return false when past deadline', () => {
      const pastDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(DateUtil.isWithinGracePeriod(pastDate, 24)).toBe(false);
    });
  });

  describe('getGraceDeadline', () => {
    it('should return deadline 24h before startDate', () => {
      const deadline = DateUtil.getGraceDeadline('2026-06-15T12:00:00.000Z', 24);
      expect(deadline).toBe('2026-06-14T12:00:00.000Z');
    });
  });

  describe('toUTC', () => {
    it('should parse an ISO string as UTC', () => {
      const d = DateUtil.toUTC('2026-01-01T00:00:00.000Z');
      expect(d.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should accept Date objects', () => {
      const d = DateUtil.toUTC(new Date('2026-06-15T00:00:00Z'));
      expect(d.year()).toBe(2026);
    });
  });

  describe('rangesOverlap', () => {
    it('returns true for overlapping ranges', () => {
      expect(DateUtil.rangesOverlap('2026-06-01', '2026-06-05', '2026-06-04', '2026-06-10')).toBe(true);
    });

    it('returns true for identical ranges', () => {
      expect(DateUtil.rangesOverlap('2026-06-01', '2026-06-05', '2026-06-01', '2026-06-05')).toBe(true);
    });

    it('returns true when one range is contained in another', () => {
      expect(DateUtil.rangesOverlap('2026-06-01', '2026-06-30', '2026-06-10', '2026-06-15')).toBe(true);
    });

    it('returns true when ranges share only the endpoint', () => {
      expect(DateUtil.rangesOverlap('2026-06-01', '2026-06-05', '2026-06-05', '2026-06-10')).toBe(true);
    });

    it('returns false for disjoint ranges', () => {
      expect(DateUtil.rangesOverlap('2026-06-01', '2026-06-05', '2026-07-01', '2026-07-10')).toBe(false);
    });
  });
});
