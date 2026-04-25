import { BalanceReadRepository } from '../balance.read.repository';
import { BalanceEntity } from '../../entities/balance.entity';

describe('BalanceReadRepository', () => {
  let repo: BalanceReadRepository;
  let mockTypeOrmRepo: any;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    repo = new BalanceReadRepository(mockTypeOrmRepo);
  });

  describe('findByEmployeeAndLocation', () => {
    it('should return balance entity for valid employee/location', async () => {
      const balance: Partial<BalanceEntity> = {
        id: 'bal-1',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        hcmBalance: 20,
      };
      mockTypeOrmRepo.findOne.mockResolvedValue(balance);

      const result = await repo.findByEmployeeAndLocation('emp-1', 'loc-1');
      expect(result).toEqual(balance);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', locationId: 'loc-1' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      const result = await repo.findByEmployeeAndLocation('unknown', 'loc-1');
      expect(result).toBeNull();
    });
  });

  describe('findByEmployeeId', () => {
    it('should return all balances for employee', async () => {
      const balances = [
        { id: 'bal-1', employeeId: 'emp-1', locationId: 'loc-1', hcmBalance: 20 },
        { id: 'bal-2', employeeId: 'emp-1', locationId: 'loc-2', hcmBalance: 10 },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(balances);

      const result = await repo.findByEmployeeId('emp-1');
      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1' },
      });
    });

    it('should return empty array when no balances', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);
      const result = await repo.findByEmployeeId('emp-1');
      expect(result).toHaveLength(0);
    });
  });
});
