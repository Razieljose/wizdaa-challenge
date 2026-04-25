import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { MockHcmService } from './mock-hcm.service';

/**
 * Mock HCM controller simulating real HCM API endpoints.
 * Supports simulation headers for testing resilience:
 * - X-Simulate-Timeout: true → delays 15s
 * - X-Simulate-Error: true → returns 500
 */
@Controller('mock-hcm')
export class MockHcmController {
  constructor(private readonly mockHcmService: MockHcmService) {}

  @Get('balances')
  async getBalance(
    @Query('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
    @Headers('x-simulate-timeout') simulateTimeout?: string,
    @Headers('x-simulate-error') simulateError?: string,
  ) {
    await this.handleSimulation(simulateTimeout, simulateError);

    const balance = this.mockHcmService.getBalance(employeeId, locationId);
    if (!balance) {
      throw new HttpException('Balance not found', HttpStatus.NOT_FOUND);
    }
    return balance;
  }

  @Post('time-off')
  @HttpCode(HttpStatus.CREATED)
  async submitTimeOff(
    @Body() body: any,
    @Headers('x-simulate-timeout') simulateTimeout?: string,
    @Headers('x-simulate-error') simulateError?: string,
  ) {
    await this.handleSimulation(simulateTimeout, simulateError);

    const result = this.mockHcmService.submitTimeOff(body);
    if (result.status === 'REJECTED') {
      throw new HttpException(
        { status: 'REJECTED', message: result.message },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return result;
  }

  @Post('time-off/:hcmReferenceId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelTimeOff(
    @Param('hcmReferenceId') hcmReferenceId: string,
    @Headers('x-simulate-timeout') simulateTimeout?: string,
    @Headers('x-simulate-error') simulateError?: string,
  ) {
    await this.handleSimulation(simulateTimeout, simulateError);

    const result = this.mockHcmService.cancelTimeOff(hcmReferenceId);
    if (result.status === 'REJECTED') {
      throw new HttpException(
        { status: 'REJECTED', message: result.message },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return result;
  }

  @Get('batch')
  async getBatchDump(
    @Headers('x-simulate-timeout') simulateTimeout?: string,
    @Headers('x-simulate-error') simulateError?: string,
  ) {
    await this.handleSimulation(simulateTimeout, simulateError);
    return this.mockHcmService.getBatchDump();
  }

  @Post('setup/balance')
  @HttpCode(HttpStatus.CREATED)
  async setupBalance(@Body() body: { employeeId: string; locationId: string; balance: number }) {
    this.mockHcmService.setBalance(body.employeeId, body.locationId, body.balance);
    return { message: 'Balance set', ...body };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset() {
    this.mockHcmService.reset();
    return { message: 'Mock HCM reset' };
  }

  private async handleSimulation(simulateTimeout?: string, simulateError?: string): Promise<void> {
    if (simulateError === 'true') {
      throw new HttpException('Simulated HCM error', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (simulateTimeout === 'true') {
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }
}
