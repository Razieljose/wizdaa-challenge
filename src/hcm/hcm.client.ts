import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { timeout, retry, catchError } from 'rxjs/operators';
import {
  IHcmClient,
  IHcmBalanceResponse,
  IHcmSubmitTimeOffRequest,
  IHcmSubmitTimeOffResponse,
  IHcmCancelResponse,
  IHcmBatchResponse,
} from './interfaces/hcm-client.interface';
import { HcmUnavailableError } from '../shared/exceptions';

/**
 * Anti-Corruption Layer for HCM API communication.
 * Implements retry with exponential backoff, timeout, and fallback to error.
 */
@Injectable()
export class HcmClient implements IHcmClient {
  private readonly logger = new Logger(HcmClient.name);
  private readonly baseUrl: string;
  private readonly pathPrefix: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('HCM_BASE_URL', 'http://localhost:3001');
    this.pathPrefix = this.configService.get<string>('HCM_PATH_PREFIX', '/mock-hcm');
    this.timeoutMs = this.configService.get<number>('HCM_TIMEOUT_MS', 10000);
    this.maxRetries = this.configService.get<number>('HCM_MAX_RETRIES', 3);
  }

  async getBalance(employeeId: string, locationId: string): Promise<IHcmBalanceResponse> {
    this.logger.debug(`Getting HCM balance for ${employeeId}/${locationId}`);
    try {
      const response = await this.makeRequest<IHcmBalanceResponse>(
        'GET',
        `${this.pathPrefix}/balances?employeeId=${employeeId}&locationId=${locationId}`,
      );
      return response;
    } catch (error: any) {
      this.logger.error(`Failed to get HCM balance: ${error?.message}`);
      throw new HcmUnavailableError({ employeeId, locationId, originalError: error?.message });
    }
  }

  async submitTimeOff(request: IHcmSubmitTimeOffRequest): Promise<IHcmSubmitTimeOffResponse> {
    this.logger.debug(`Submitting time-off to HCM: ${request.referenceId}`);
    try {
      const response = await this.makeRequest<IHcmSubmitTimeOffResponse>(
        'POST',
        `${this.pathPrefix}/time-off`,
        request,
      );
      return response;
    } catch (error: any) {
      this.logger.error(`Failed to submit time-off to HCM: ${error?.message}`);
      throw new HcmUnavailableError({ referenceId: request.referenceId, originalError: error?.message });
    }
  }

  async cancelTimeOff(hcmReferenceId: string): Promise<IHcmCancelResponse> {
    this.logger.debug(`Cancelling time-off in HCM: ${hcmReferenceId}`);
    try {
      const response = await this.makeRequest<IHcmCancelResponse>(
        'POST',
        `${this.pathPrefix}/time-off/${hcmReferenceId}/cancel`,
      );
      return response;
    } catch (error: any) {
      this.logger.error(`Failed to cancel time-off in HCM: ${error?.message}`);
      throw new HcmUnavailableError({ hcmReferenceId, originalError: error?.message });
    }
  }

  async getBatchBalances(): Promise<IHcmBatchResponse> {
    this.logger.debug('Getting batch balances from HCM');
    try {
      const response = await this.makeRequest<IHcmBatchResponse>('GET', `${this.pathPrefix}/batch`);
      return response;
    } catch (error: any) {
      this.logger.error(`Failed to get batch balances from HCM: ${error?.message}`);
      throw new HcmUnavailableError({ originalError: error?.message });
    }
  }

  /**
   * Makes an HTTP request with retry and timeout.
   * Implements exponential backoff: 1s, 2s, 4s.
   */
  private async makeRequest<T>(method: string, path: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const observable = method === 'GET'
          ? this.httpService.get<T>(url)
          : this.httpService.post<T>(url, data);

        const response = await firstValueFrom(
          observable.pipe(
            timeout(this.timeoutMs),
            catchError((err) => {
              throw err;
            }),
          ),
        );

        return response.data;
      } catch (error: any) {
        const isLastAttempt = attempt === this.maxRetries;

        if (isLastAttempt) {
          this.logger.error(
            `HCM request failed after ${this.maxRetries + 1} attempts: ${method} ${path}`,
          );
          throw error;
        }

        const backoffMs = Math.pow(2, attempt) * 1000;
        this.logger.warn(
          `HCM request attempt ${attempt + 1} failed, retrying in ${backoffMs}ms: ${error.message}`,
        );
        await this.sleep(backoffMs);
      }
    }

    throw new HcmUnavailableError({ method, path });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
