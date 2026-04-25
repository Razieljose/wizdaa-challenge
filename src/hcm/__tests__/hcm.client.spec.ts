import { HcmClient } from '../hcm.client';
import { HcmUnavailableError } from '../../shared/exceptions';

describe('HcmClient', () => {
  let client: HcmClient;
  let mockHttpService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
        const config: Record<string, any> = {
          HCM_BASE_URL: 'http://localhost:3001',
          HCM_PATH_PREFIX: '/mock-hcm',
          HCM_TIMEOUT_MS: 1000,
          HCM_MAX_RETRIES: 1,
        };
        return config[key] ?? defaultValue;
      }),
    };

    client = new HcmClient(mockHttpService, mockConfigService);
  });

  describe('getBalance', () => {
    it('should throw HcmUnavailableError on failure', async () => {
      const { of, throwError } = require('rxjs');
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      await expect(client.getBalance('emp-1', 'loc-1')).rejects.toThrow(HcmUnavailableError);
    });
  });

  describe('submitTimeOff', () => {
    it('should throw HcmUnavailableError on failure', async () => {
      const { throwError } = require('rxjs');
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Timeout')));

      const request = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 3,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        referenceId: 'ref-1',
      };

      await expect(client.submitTimeOff(request)).rejects.toThrow(HcmUnavailableError);
    });
  });

  describe('cancelTimeOff', () => {
    it('should throw HcmUnavailableError on failure', async () => {
      const { throwError } = require('rxjs');
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Error')));

      await expect(client.cancelTimeOff('hcm-ref-1')).rejects.toThrow(HcmUnavailableError);
    });
  });

  describe('getBatchBalances', () => {
    it('should throw HcmUnavailableError on failure', async () => {
      const { throwError } = require('rxjs');
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Error')));

      await expect(client.getBatchBalances()).rejects.toThrow(HcmUnavailableError);
    });
  });
});
