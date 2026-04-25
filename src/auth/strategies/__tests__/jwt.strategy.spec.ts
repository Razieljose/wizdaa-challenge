import { JwtStrategy } from '../jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '../../../shared/types';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockConfigService: any;
  let mockUserRepo: any;
  let mockRoleRepo: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };

    mockUserRepo = {
      findOne: jest.fn(),
    };

    mockRoleRepo = {
      find: jest.fn(),
    };

    strategy = new JwtStrategy(mockConfigService, mockUserRepo, mockRoleRepo);
  });

  describe('validate', () => {
    it('should return IActor when user is found and active', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        isActive: true,
      };

      const roles = [
        { locationId: 'loc-1', role: Role.EMPLOYEE },
        { locationId: 'loc-2', role: Role.MANAGER },
      ];

      mockUserRepo.findOne.mockResolvedValue(user);
      mockRoleRepo.find.mockResolvedValue(roles);

      const result = await strategy.validate({ sub: 'user-1', email: 'test@test.com', name: 'Test User' });

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        roles: [
          { locationId: 'loc-1', role: Role.EMPLOYEE },
          { locationId: 'loc-2', role: Role.MANAGER },
        ],
        employeeLocationIds: ['loc-1'],
        managedLocationIds: ['loc-2'],
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'unknown', email: 'x', name: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        isActive: false,
      });

      await expect(
        strategy.validate({ sub: 'user-1', email: 'test@test.com', name: 'Test' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should separate employee and manager location IDs', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'multi@test.com',
        name: 'Multi Role',
        isActive: true,
      });

      mockRoleRepo.find.mockResolvedValue([
        { locationId: 'loc-A', role: Role.EMPLOYEE },
        { locationId: 'loc-B', role: Role.EMPLOYEE },
        { locationId: 'loc-C', role: Role.MANAGER },
      ]);

      const result = await strategy.validate({ sub: 'user-1', email: 'multi@test.com', name: 'Multi Role' });

      expect(result.employeeLocationIds).toEqual(['loc-A', 'loc-B']);
      expect(result.managedLocationIds).toEqual(['loc-C']);
    });

    it('should handle user with no roles', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'noroles@test.com',
        name: 'No Roles',
        isActive: true,
      });

      mockRoleRepo.find.mockResolvedValue([]);

      const result = await strategy.validate({ sub: 'user-1', email: 'noroles@test.com', name: 'No Roles' });

      expect(result.roles).toEqual([]);
      expect(result.employeeLocationIds).toEqual([]);
      expect(result.managedLocationIds).toEqual([]);
    });
  });
});
