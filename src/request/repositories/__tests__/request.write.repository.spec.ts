import { RequestWriteRepository } from '../request.write.repository';
import { TimeOffRequestEntity } from '../../entities/time-off-request.entity';

describe('RequestWriteRepository', () => {
  let repo: RequestWriteRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
    };
    repo = new RequestWriteRepository(mockTypeOrmRepo);
  });

  describe('saveRequest', () => {
    it('should save entity with updated timestamp', async () => {
      const entity = new TimeOffRequestEntity();
      entity.id = 'req-1';
      entity.status = 'PENDING' as any;

      const result = await repo.saveRequest(entity);

      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
      expect(result.updatedAt).toBeDefined();
    });

    it('should propagate save errors', async () => {
      mockTypeOrmRepo.save.mockRejectedValue(new Error('DB error'));

      const entity = new TimeOffRequestEntity();
      entity.id = 'req-1';

      await expect(repo.saveRequest(entity)).rejects.toThrow('DB error');
    });
  });
});
