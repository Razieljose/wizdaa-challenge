import { RequestAuditRepository } from '../request-audit.repository';

describe('RequestAuditRepository', () => {
  let repo: RequestAuditRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
      find: jest.fn(),
    };
    repo = new RequestAuditRepository(mockTypeOrmRepo);
  });

  describe('logTransition', () => {
    it('should create an audit log entry', async () => {
      const result = await repo.logTransition(
        'req-1', 'actor-1', 'PENDING', 'APPROVED', 'approve',
      );

      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0];
      expect(savedEntity.requestId).toBe('req-1');
      expect(savedEntity.actorId).toBe('actor-1');
      expect(savedEntity.previousStatus).toBe('PENDING');
      expect(savedEntity.newStatus).toBe('APPROVED');
      expect(savedEntity.action).toBe('approve');
    });

    it('should include reason when provided', async () => {
      await repo.logTransition(
        'req-1', 'actor-1', 'PENDING', 'CANCELLED', 'reject', 'Too busy',
      );

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0];
      expect(savedEntity.reason).toBe('Too busy');
    });

    it('should use empty string when reason not provided', async () => {
      await repo.logTransition(
        'req-1', 'actor-1', 'PENDING', 'APPROVED', 'approve',
      );

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0];
      expect(savedEntity.reason).toBe('');
    });
  });

  describe('findByRequestId', () => {
    it('should return audit logs ordered by timestamp', async () => {
      const logs = [
        { id: 'audit-1', requestId: 'req-1', createdAtTimestamp: 1000 },
        { id: 'audit-2', requestId: 'req-1', createdAtTimestamp: 2000 },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(logs);

      const result = await repo.findByRequestId('req-1');
      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { requestId: 'req-1' },
        order: { createdAtTimestamp: 'ASC' },
      });
    });

    it('should return empty array when no logs found', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);
      const result = await repo.findByRequestId('unknown');
      expect(result).toHaveLength(0);
    });
  });
});
