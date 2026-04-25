import { HcmClient } from '../hcm.client';
import { of } from 'rxjs';

describe('HcmClient - success scenarios', () => {
  let client: HcmClient;
  let mockHttpService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockHttpService = { get: jest.fn(), post: jest.fn() };
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
        const config: Record<string, any> = {
          HCM_BASE_URL: 'http://localhost:3001',
          HCM_PATH_PREFIX: '/mock-hcm',
          HCM_TIMEOUT_MS: 5000,
          HCM_MAX_RETRIES: 0,
        };
        return config[key] ?? defaultValue;
      }),
    };
    client = new HcmClient(mockHttpService, mockConfigService);
  });

  it('getBalance returns balance on success', async () => {
    const data = { employeeId: 'e1', locationId: 'l1', balance: 20, updatedAt: '2026-01-01' };
    mockHttpService.get.mockReturnValue(of({ data }));
    const result = await client.getBalance('e1', 'l1');
    expect(result.balance).toBe(20);
  });

  it('submitTimeOff returns accepted', async () => {
    mockHttpService.post.mockReturnValue(of({ data: { hcmReferenceId: 'ref', status: 'ACCEPTED' } }));
    const result = await client.submitTimeOff({
      employeeId: 'e1', locationId: 'l1', daysRequested: 3,
      startDate: '2026-06-01', endDate: '2026-06-03', referenceId: 'r1',
    });
    expect(result.status).toBe('ACCEPTED');
  });

  it('cancelTimeOff returns confirmed', async () => {
    mockHttpService.post.mockReturnValue(of({ data: { status: 'CONFIRMED' } }));
    const result = await client.cancelTimeOff('ref-1');
    expect(result.status).toBe('CONFIRMED');
  });

  it('getBatchBalances returns batch', async () => {
    const data = {
      generatedAt: '2026-06-01', generatedAtTimestamp: 178e7,
      balances: [{ employeeId: 'e1', locationId: 'l1', balance: 18 }],
    };
    mockHttpService.get.mockReturnValue(of({ data }));
    const result = await client.getBatchBalances();
    expect(result.balances).toHaveLength(1);
  });
});
