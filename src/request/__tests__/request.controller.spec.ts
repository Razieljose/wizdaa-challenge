import { RequestController } from '../request.controller';
import { RequestStatus, Role } from '../../shared/types';
import { IActor } from '../../shared/interfaces';

describe('RequestController', () => {
  let controller: RequestController;
  let mockRequestService: any;

  const mockActor: IActor = {
    id: 'emp-1',
    email: 'emp@test.com',
    name: 'Employee',
    roles: [{ locationId: 'loc-1', role: Role.EMPLOYEE }],
    employeeLocationIds: ['loc-1'],
    managedLocationIds: [],
  };

  const mockManagerActor: IActor = {
    id: 'mgr-1',
    email: 'mgr@test.com',
    name: 'Manager',
    roles: [{ locationId: 'loc-1', role: Role.MANAGER }],
    employeeLocationIds: [],
    managedLocationIds: ['loc-1'],
  };

  beforeEach(() => {
    mockRequestService = {
      submit: jest.fn().mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
        employeeId: 'emp-1',
        locationId: 'loc-1',
      }),
      approve: jest.fn().mockResolvedValue({
        requestId: 'req-1',
        previousStatus: RequestStatus.PENDING,
        newStatus: RequestStatus.APPROVED,
        message: 'Approved',
      }),
      reject: jest.fn().mockResolvedValue({
        requestId: 'req-1',
        previousStatus: RequestStatus.PENDING,
        newStatus: RequestStatus.CANCELLED,
        message: 'Rejected',
      }),
      cancel: jest.fn().mockResolvedValue({
        requestId: 'req-1',
        previousStatus: RequestStatus.PENDING,
        newStatus: RequestStatus.CANCELLED,
        message: 'Cancelled',
      }),
      findById: jest.fn().mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.PENDING,
      }),
      findByEmployee: jest.fn().mockResolvedValue([]),
    };
    controller = new RequestController(mockRequestService);
  });

  describe('submit', () => {
    it('should call service.submit with input and actor', async () => {
      const input = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 3,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        idempotencyKey: 'key-1',
      };

      const result = await controller.submit(input, mockActor);
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(mockRequestService.submit).toHaveBeenCalledWith(input, mockActor);
    });
  });

  describe('approve', () => {
    it('should call service.approve', async () => {
      const result = await controller.approve('req-1', mockManagerActor);
      expect(result.newStatus).toBe(RequestStatus.APPROVED);
      expect(mockRequestService.approve).toHaveBeenCalledWith('req-1', mockManagerActor);
    });
  });

  describe('reject', () => {
    it('should call service.reject with reason', async () => {
      const input = { requestId: 'req-1', reason: 'No capacity' };
      const result = await controller.reject('req-1', input, mockManagerActor);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });
  });

  describe('cancel', () => {
    it('should call service.cancel', async () => {
      const result = await controller.cancel('req-1', mockActor);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });
  });

  describe('findById', () => {
    it('should return request by id', async () => {
      const result = await controller.findById('req-1');
      expect(result.id).toBe('req-1');
    });
  });

  describe('findByEmployee', () => {
    it('should call service.findByEmployee with optional locationId', async () => {
      await controller.findByEmployee('emp-1', 'loc-1');
      expect(mockRequestService.findByEmployee).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should call service.findByEmployee without locationId', async () => {
      await controller.findByEmployee('emp-1');
      expect(mockRequestService.findByEmployee).toHaveBeenCalledWith('emp-1', undefined);
    });
  });
});
