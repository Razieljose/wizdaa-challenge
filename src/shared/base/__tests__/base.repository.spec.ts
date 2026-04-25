import { BaseRepository } from '../base.repository';
import { Repository, ObjectLiteral } from 'typeorm';

// Test entity type
interface TestEntity extends ObjectLiteral {
  id: string;
  name: string;
}

class ConcreteRepository extends BaseRepository<TestEntity> {
  constructor(repo: Repository<TestEntity>) {
    super(repo);
  }
}

describe('BaseRepository', () => {
  let repo: ConcreteRepository;
  let mockTypeOrmRepo: jest.Mocked<Repository<TestEntity>>;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as any;

    repo = new ConcreteRepository(mockTypeOrmRepo);
  });

  it('findById should call findOne with id', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue({ id: '1', name: 'Test' });
    const result = await repo.findById('1');
    expect(result).toEqual({ id: '1', name: 'Test' });
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('findOne should delegate to repository', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue({ id: '1', name: 'Test' });
    await repo.findOne({ name: 'Test' } as any);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({ where: { name: 'Test' } });
  });

  it('findMany should delegate to repository', async () => {
    mockTypeOrmRepo.find.mockResolvedValue([{ id: '1', name: 'Test' }]);
    const result = await repo.findMany();
    expect(result).toHaveLength(1);
  });

  it('save should delegate to repository', async () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    mockTypeOrmRepo.save.mockResolvedValue(entity);
    const result = await repo.save(entity);
    expect(result).toEqual(entity);
  });

  it('remove should delegate to repository', async () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    mockTypeOrmRepo.remove.mockResolvedValue(entity);
    const result = await repo.remove(entity);
    expect(result).toEqual(entity);
  });
});
