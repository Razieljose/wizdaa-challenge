import { UserRepository } from '../user.repository';
import { UserEntity } from '../../entities/user.entity';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    repository = new UserRepository(mockTypeOrmRepo);
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const user = { id: 'user-1', email: 'test@test.com', name: 'Test' };
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repository.findById('user-1');

      expect(result).toEqual(user);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null when user not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const user = { id: 'user-1', email: 'test@test.com', name: 'Test' };
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repository.findByEmail('test@test.com');

      expect(result).toEqual(user);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });

    it('should return null when email not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('unknown@test.com');
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should save a user entity', async () => {
      const user = { id: 'user-1', email: 'test@test.com' } as UserEntity;
      mockTypeOrmRepo.save.mockResolvedValue(user);

      const result = await repository.save(user);

      expect(result).toEqual(user);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(user);
    });
  });

  describe('findMany', () => {
    it('should return all users when no filter', async () => {
      const users = [
        { id: 'u1', email: 'a@test.com' },
        { id: 'u2', email: 'b@test.com' },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(users);

      const result = await repository.findMany();
      expect(result).toHaveLength(2);
    });

    it('should filter users by criteria', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);
      await repository.findMany({ email: 'x@test.com' } as any);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({ where: { email: 'x@test.com' } });
    });
  });

  describe('remove', () => {
    it('should remove a user entity', async () => {
      const user = { id: 'user-1' } as UserEntity;
      mockTypeOrmRepo.remove.mockResolvedValue(user);

      const result = await repository.remove(user);
      expect(result).toEqual(user);
      expect(mockTypeOrmRepo.remove).toHaveBeenCalledWith(user);
    });
  });
});
