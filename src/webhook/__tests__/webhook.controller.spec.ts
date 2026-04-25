import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookController } from '../webhook.controller';
import { BalanceService } from '../../balance/services/balance.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let balanceService: jest.Mocked<BalanceService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: BalanceService,
          useValue: { updateHcmBalance: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    balanceService = module.get(BalanceService);
    configService = module.get(ConfigService);
  });

  describe('handleHcmBalanceUpdate', () => {
    const dto = {
      employeeId: 'emp-1',
      locationId: 'loc-001',
      balance: 15,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedAtTimestamp: 1735689600,
    };

    it('should call updateHcmBalance and return received:true with valid secret', async () => {
      const result = await controller.handleHcmBalanceUpdate(dto, 'test-secret');

      expect(balanceService.updateHcmBalance).toHaveBeenCalledWith(
        dto.employeeId,
        dto.locationId,
        dto.balance,
        dto.generatedAtTimestamp,
      );
      expect(result).toEqual({ received: true });
    });

    it('should throw UnauthorizedException when secret does not match', async () => {
      await expect(
        controller.handleHcmBalanceUpdate(dto, 'wrong-secret'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(balanceService.updateHcmBalance).not.toHaveBeenCalled();
    });

    it('should skip secret validation when WEBHOOK_SECRET is empty', async () => {
      configService.get.mockReturnValue('');
      const noSecretController = new WebhookController(balanceService, configService);

      const result = await noSecretController.handleHcmBalanceUpdate(dto, '');
      expect(result).toEqual({ received: true });
    });
  });
});
