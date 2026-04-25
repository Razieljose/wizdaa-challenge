import { BalanceWriteRepository } from '../balance.write.repository';
import { BalanceEntity } from '../../entities/balance.entity';
import { OptimisticLockError } from '../../../shared/exceptions';

describe('BalanceWriteRepository', () => {
  let repo: BalanceWriteRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, version: 1 })),
    };
    repo = new BalanceWriteRepository(mockTypeOrmRepo);
  });

  describe('upsertBalance', () => {
    it('should create new balance when none exists', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.upsertBalance('emp-1', 'loc-1', 20, 1700000000);

      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0];
      expect(savedEntity.employeeId).toBe('emp-1');
      expect(savedEntity.locationId).toBe('loc-1');
      expect(savedEntity.hcmBalance).toBe(20);
    });

    it('should update existing balance', async () => {
      const existing = new BalanceEntity();
      existing.id = 'bal-1';
      existing.employeeId = 'emp-1';
      existing.locationId = 'loc-1';
      existing.hcmBalance = 15;
      existing.version = 1;
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);

      await repo.upsertBalance('emp-1', 'loc-1', 25, 1700000000);

      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0];
      expect(savedEntity.id).toBe('bal-1');
      expect(savedEntity.hcmBalance).toBe(25);
    });
  });

  describe('updateBalanceWithVersion', () => {
    it('should save entity successfully', async () => {
      const entity = new BalanceEntity();
      entity.id = 'bal-1';
      entity.version = 1;

      const result = await repo.updateBalanceWithVersion(entity);
      expect(result).toBeDefined();
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(entity);
    });

    it('should throw OptimisticLockError on version mismatch', async () => {
      const entity = new BalanceEntity();
      entity.id = 'bal-1';
      entity.version = 1;

      mockTypeOrmRepo.save.mockRejectedValue({
        name: 'OptimisticLockVersionMismatchError',
        message: 'version mismatch',
      });

      await expect(repo.updateBalanceWithVersion(entity)).rejects.toThrow(OptimisticLockError);
    });

    it('should rethrow non-version errors', async () => {
      const entity = new BalanceEntity();
      entity.id = 'bal-1';

      mockTypeOrmRepo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(repo.updateBalanceWithVersion(entity)).rejects.toThrow('DB connection lost');
    });
  });
});
