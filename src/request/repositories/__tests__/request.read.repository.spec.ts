import { RequestReadRepository } from '../request.read.repository';
import { RequestStatus } from '../../../shared/types';

describe('RequestReadRepository', () => {
  let repo: RequestReadRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    repo = new RequestReadRepository(mockTypeOrmRepo);
  });

  describe('findByIdempotencyKey', () => {
    it('should find request by idempotency key', async () => {
      const request = { id: 'req-1', idempotencyKey: 'key-1' };
      mockTypeOrmRepo.findOne.mockResolvedValue(request);

      const result = await repo.findByIdempotencyKey('key-1');
      expect(result).toEqual(request);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { idempotencyKey: 'key-1' },
      });
    });

    it('should return null for unknown key', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      const result = await repo.findByIdempotencyKey('unknown');
      expect(result).toBeNull();
    });
  });

  describe('findByEmployeeAndStatus', () => {
    it('should return requests matching employee and statuses', async () => {
      const requests = [
        { id: 'req-1', employeeId: 'emp-1', status: RequestStatus.PENDING },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(requests);

      const result = await repo.findByEmployeeAndStatus('emp-1', [RequestStatus.PENDING]);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOverlapping', () => {
    it('should find overlapping requests using query builder', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'req-overlap' }]),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await repo.findOverlapping(
        'emp-1', 'loc-1', 1700000000, 1700100000,
        [RequestStatus.CANCELLED, RequestStatus.FAILED],
      );

      expect(result).toHaveLength(1);
      expect(mockQb.where).toHaveBeenCalled();
      expect(mockQb.andWhere).toHaveBeenCalled();
    });

    it('should handle empty excludeStatuses', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await repo.findOverlapping('emp-1', 'loc-1', 1700000000, 1700100000, []);
      expect(result).toHaveLength(0);
    });
  });

  describe('findByStatusIn', () => {
    it('should return requests with matching statuses', async () => {
      const requests = [
        { id: 'req-1', status: RequestStatus.APPROVED },
        { id: 'req-2', status: RequestStatus.APPROVED },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(requests);

      const result = await repo.findByStatusIn([RequestStatus.APPROVED]);
      expect(result).toHaveLength(2);
    });
  });

  describe('findPendingDeductionsAfterTimestamp', () => {
    it('should find pending requests created after timestamp', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'req-1' }]),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await repo.findPendingDeductionsAfterTimestamp('emp-1', 'loc-1', 1700000000);
      expect(result).toHaveLength(1);
    });
  });

  describe('sumPendingDeductions', () => {
    it('returns the SUM of daysRequested for active statuses', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '7' }),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await repo.sumPendingDeductions('emp-1', 'loc-1');

      expect(result).toBe(7);
      expect(mockQb.select).toHaveBeenCalledWith('COALESCE(SUM(r.daysRequested), 0)', 'total');
      expect(mockQb.where).toHaveBeenCalledWith('r.employeeId = :employeeId', { employeeId: 'emp-1' });

      const statusCall = mockQb.andWhere.mock.calls.find(
        (call: any) => typeof call[0] === 'string' && call[0].includes('status IN'),
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1].statuses).toEqual([
        RequestStatus.PENDING,
        RequestStatus.APPROVED,
        RequestStatus.IN_SYNC,
      ]);
    });

    it('returns 0 when no rows match', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await repo.sumPendingDeductions('emp-1', 'loc-1');
      expect(result).toBe(0);
    });

    it('returns 0 when getRawOne returns undefined', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(undefined),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await repo.sumPendingDeductions('emp-1', 'loc-1');
      expect(result).toBe(0);
    });
  });
});
