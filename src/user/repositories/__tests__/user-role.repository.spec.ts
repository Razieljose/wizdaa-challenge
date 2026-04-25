import { UserRoleRepository } from '../user-role.repository';
import { UserLocationRoleEntity } from '../../entities/user-location-role.entity';
import { Role } from '../../../shared/types';

describe('UserRoleRepository', () => {
  let repository: UserRoleRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    repository = new UserRoleRepository(mockTypeOrmRepo);
  });

  describe('findByUserId', () => {
    it('should find all roles for a user', async () => {
      const roles = [
        { id: 'r1', userId: 'user-1', locationId: 'loc-1', role: Role.EMPLOYEE },
        { id: 'r2', userId: 'user-1', locationId: 'loc-2', role: Role.MANAGER },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(roles);

      const result = await repository.findByUserId('user-1');

      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('should return empty array when no roles found', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      const result = await repository.findByUserId('no-roles');
      expect(result).toEqual([]);
    });
  });

  describe('findByLocationIdAndRole', () => {
    it('should find roles by location and role type', async () => {
      const roles = [
        { id: 'r1', userId: 'user-1', locationId: 'loc-1', role: Role.MANAGER },
        { id: 'r2', userId: 'user-2', locationId: 'loc-1', role: Role.MANAGER },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(roles);

      const result = await repository.findByLocationIdAndRole('loc-1', Role.MANAGER);

      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { locationId: 'loc-1', role: Role.MANAGER },
      });
    });
  });

  describe('findOne', () => {
    it('should find a specific role assignment', async () => {
      const role = { id: 'r1', userId: 'user-1', locationId: 'loc-1', role: Role.EMPLOYEE };
      mockTypeOrmRepo.findOne.mockResolvedValue(role);

      const result = await repository.findOne({
        userId: 'user-1',
        locationId: 'loc-1',
        role: Role.EMPLOYEE,
      } as any);

      expect(result).toEqual(role);
    });

    it('should return null when role not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findOne({ userId: 'unknown' } as any);
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should save a role assignment', async () => {
      const role = {
        id: 'r1',
        userId: 'user-1',
        locationId: 'loc-1',
        role: Role.EMPLOYEE,
      } as UserLocationRoleEntity;
      mockTypeOrmRepo.save.mockResolvedValue(role);

      const result = await repository.save(role);
      expect(result).toEqual(role);
    });
  });
});
