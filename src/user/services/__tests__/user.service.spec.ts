import { UserService } from '../user.service';
import { NotFoundError, ForbiddenError } from '../../../shared/exceptions';

describe('UserService', () => {
  let service: UserService;
  let mockUserRepo: any;
  let mockUserWriteRepo: any;
  let mockUserRoleRepo: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
    };

    mockUserWriteRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
    };

    mockUserRoleRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    service = new UserService(mockUserRepo, mockUserWriteRepo, mockUserRoleRepo, mockJwtService);
  });

  describe('createUser', () => {
    it('should create a new user with hashed password', async () => {
      const result = await service.createUser({
        email: 'new@test.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result.email).toBe('new@test.com');
      expect(result.name).toBe('New User');
      expect(mockUserWriteRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenError if email already exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 'existing', email: 'dup@test.com' });

      await expect(service.createUser({
        email: 'dup@test.com',
        name: 'Dup',
        password: 'password123',
      })).rejects.toThrow(ForbiddenError);
    });
  });

  describe('findById', () => {
    it('should return user output', async () => {
      mockUserRepo.findById.mockResolvedValue({
        id: 'user1',
        email: 'user@test.com',
        name: 'User',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });

      const result = await service.findById('user1');
      expect(result.id).toBe('user1');
    });

    it('should throw NotFoundError if user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('login', () => {
    it('should throw NotFoundError for unknown email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      await expect(service.login('unknown@test.com', 'pass')).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for inactive user', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'inactive@test.com',
        name: 'Inactive',
        isActive: false,
        passwordHash: '$2b$10$hash',
      });

      await expect(service.login('inactive@test.com', 'pass')).rejects.toThrow(ForbiddenError);
    });

    it('should return accessToken and user on successful login', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correct-password', 10);
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'ok@test.com',
        name: 'OK User',
        isActive: true,
        passwordHash: hash,
      });

      const result = await service.login('ok@test.com', 'correct-password');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe('u1');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('should throw ForbiddenError for invalid password', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correct-password', 10);
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'ok@test.com',
        name: 'OK',
        isActive: true,
        passwordHash: hash,
      });

      await expect(service.login('ok@test.com', 'wrong-password')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('assignRole', () => {
    it('should assign a new role', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'user1' });

      await service.assignRole({
        userId: 'user1',
        locationId: 'loc-1',
        role: 'MANAGER' as any,
      });

      expect(mockUserRoleRepo.save).toHaveBeenCalled();
    });

    it('should skip if role already assigned', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'user1' });
      mockUserRoleRepo.findOne.mockResolvedValue({ id: 'existing-role' });

      await service.assignRole({
        userId: 'user1',
        locationId: 'loc-1',
        role: 'MANAGER' as any,
      });

      expect(mockUserRoleRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for missing user', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.assignRole({
        userId: 'missing',
        locationId: 'loc-1',
        role: 'MANAGER' as any,
      })).rejects.toThrow(NotFoundError);
    });
  });
});
