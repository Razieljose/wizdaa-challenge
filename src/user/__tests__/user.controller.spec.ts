import { UserController } from '../user.controller';
import { UserService } from '../services/user.service';
import { Role } from '../../shared/types';
import { ForbiddenError, NotFoundError } from '../../shared/exceptions';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: any;

  beforeEach(() => {
    mockUserService = {
      createUser: jest.fn(),
      login: jest.fn(),
      assignRole: jest.fn(),
      findById: jest.fn(),
    };

    controller = new UserController(mockUserService);
  });

  describe('createUser', () => {
    it('should create a user and return output', async () => {
      const input = {
        email: 'new@test.com',
        name: 'New User',
        password: 'secure-password',
      };
      const output = {
        id: 'user-1',
        email: 'new@test.com',
        name: 'New User',
        isActive: true,
        roles: [],
      };
      mockUserService.createUser.mockResolvedValue(output);

      const result = await controller.createUser(input as any);

      expect(result).toEqual(output);
      expect(mockUserService.createUser).toHaveBeenCalledWith(input);
    });

    it('should propagate ForbiddenError for duplicate email', async () => {
      const input = { email: 'dup@test.com', name: 'Dup', password: 'pass123456' };
      mockUserService.createUser.mockRejectedValue(
        new ForbiddenError('User with email dup@test.com already exists'),
      );

      await expect(controller.createUser(input as any)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('login', () => {
    it('should return access token on valid credentials', async () => {
      const loginResult = {
        accessToken: 'jwt-token',
        user: { id: 'user-1', email: 'test@test.com' },
      };
      mockUserService.login.mockResolvedValue(loginResult);

      const result = await controller.login({ email: 'test@test.com', password: 'password123' } as any);

      expect(result.accessToken).toBe('jwt-token');
      expect(mockUserService.login).toHaveBeenCalledWith('test@test.com', 'password123');
    });

    it('should propagate ForbiddenError on invalid credentials', async () => {
      mockUserService.login.mockRejectedValue(new ForbiddenError('Invalid credentials'));

      await expect(
        controller.login({ email: 'test@test.com', password: 'wrong' } as any),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('assignRole', () => {
    it('should assign role via service', async () => {
      const actor = { id: 'mgr-1' };
      const input = {
        userId: 'user-1',
        locationId: 'loc-1',
        role: Role.EMPLOYEE,
      };
      mockUserService.assignRole.mockResolvedValue(undefined);

      await controller.assignRole(input as any, actor);

      expect(input).toHaveProperty('assignedBy', 'mgr-1');
      expect(mockUserService.assignRole).toHaveBeenCalledWith(input);
    });
  });

  describe('findById', () => {
    it('should return user output by id', async () => {
      const output = { id: 'user-1', email: 'test@test.com', name: 'Test' };
      mockUserService.findById.mockResolvedValue(output);

      const result = await controller.findById('user-1');

      expect(result).toEqual(output);
      expect(mockUserService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should propagate NotFoundError', async () => {
      mockUserService.findById.mockRejectedValue(new NotFoundError('User', 'missing'));

      await expect(controller.findById('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
