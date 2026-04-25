import { SeedService } from '../seed.service';
import { ConfigService } from '@nestjs/config';

describe('SeedService', () => {
  let service: SeedService;
  let mockDataSource: any;
  let mockConfigService: jest.Mocked<ConfigService>;

  const buildDataSource = (userCount = 0) => ({
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)')) return Promise.resolve([{ cnt: userCount }]);
      return Promise.resolve([]);
    }),
  });

  beforeEach(() => {
    mockDataSource = buildDataSource(0);
    mockConfigService = {
      get: jest.fn().mockReturnValue('development'),
    } as any;

    service = new SeedService(mockDataSource, mockConfigService);
  });

  describe('onModuleInit', () => {
    it('should call seed in development environment', async () => {
      const seedSpy = jest.spyOn(service, 'seed').mockResolvedValue();
      await service.onModuleInit();
      expect(seedSpy).toHaveBeenCalled();
    });

    it('should skip seed in production environment', async () => {
      mockConfigService.get.mockReturnValue('production');
      const seedSpy = jest.spyOn(service, 'seed').mockResolvedValue();
      await service.onModuleInit();
      expect(seedSpy).not.toHaveBeenCalled();
    });
  });

  describe('seed', () => {
    it('should skip seeding when database already has users', async () => {
      mockDataSource = buildDataSource(3);
      service = new SeedService(mockDataSource, mockConfigService);

      await service.seed();

      const insertCalls = mockDataSource.query.mock.calls.filter((c: string[]) =>
        c[0].includes('INSERT'),
      );
      expect(insertCalls).toHaveLength(0);
    });

    it('should insert users, roles, balances and requests when DB is empty', async () => {
      await service.seed();

      const insertCalls = mockDataSource.query.mock.calls.filter((c: string[]) =>
        c[0].includes('INSERT'),
      );
      expect(insertCalls.length).toBeGreaterThan(0);

      const userInserts = insertCalls.filter((c: string[]) => c[0].includes('INSERT INTO users'));
      expect(userInserts).toHaveLength(3);

      const roleInserts = insertCalls.filter((c: string[]) =>
        c[0].includes('INSERT INTO user_location_roles'),
      );
      expect(roleInserts).toHaveLength(4);

      const balanceInserts = insertCalls.filter((c: string[]) =>
        c[0].includes('INSERT INTO employee_balances'),
      );
      expect(balanceInserts).toHaveLength(2);
    });
  });
});
