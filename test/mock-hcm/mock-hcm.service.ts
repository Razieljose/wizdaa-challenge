import { Injectable, Logger } from '@nestjs/common';
import { UuidUtil } from '../../src/shared/utils/uuid.util';
import { DateUtil } from '../../src/shared/utils/date.util';

export interface MockBalance {
  employeeId: string;
  locationId: string;
  balance: number;
  updatedAt: string;
}

interface MockTimeOff {
  hcmReferenceId: string;
  employeeId: string;
  locationId: string;
  daysRequested: number;
  startDate: string;
  endDate: string;
  referenceId: string;
  status: 'ACTIVE' | 'CANCELLED';
}

/**
 * In-memory mock HCM service for testing.
 * Simulates real HCM behavior including timeouts and errors.
 */
@Injectable()
export class MockHcmService {
  private readonly logger = new Logger(MockHcmService.name);
  private balances: Map<string, MockBalance> = new Map();
  private timeOffs: Map<string, MockTimeOff> = new Map();

  /**
   * Initialize a balance for an employee/location.
   */
  setBalance(employeeId: string, locationId: string, balance: number): void {
    const key = `${employeeId}:${locationId}`;
    this.balances.set(key, {
      employeeId,
      locationId,
      balance,
      updatedAt: DateUtil.nowISO(),
    });
  }

  /**
   * Get balance for an employee/location.
   */
  getBalance(employeeId: string, locationId: string): MockBalance | null {
    const key = `${employeeId}:${locationId}`;
    return this.balances.get(key) || null;
  }

  /**
   * Submit time-off: deducts balance and stores record.
   * Returns REJECTED if insufficient balance.
   */
  submitTimeOff(data: {
    employeeId: string;
    locationId: string;
    daysRequested: number;
    startDate: string;
    endDate: string;
    referenceId: string;
  }): { status: 'ACCEPTED' | 'REJECTED'; hcmReferenceId?: string; message?: string } {
    const key = `${data.employeeId}:${data.locationId}`;
    const balance = this.balances.get(key);

    if (!balance) {
      return { status: 'REJECTED', message: 'Employee balance not found in HCM' };
    }

    if (balance.balance < data.daysRequested) {
      return {
        status: 'REJECTED',
        message: `Insufficient HCM balance: ${balance.balance} < ${data.daysRequested}`,
      };
    }

    // Deduct balance
    balance.balance -= data.daysRequested;
    balance.updatedAt = DateUtil.nowISO();

    const hcmReferenceId = UuidUtil.generate();
    this.timeOffs.set(hcmReferenceId, {
      hcmReferenceId,
      employeeId: data.employeeId,
      locationId: data.locationId,
      daysRequested: data.daysRequested,
      startDate: data.startDate,
      endDate: data.endDate,
      referenceId: data.referenceId,
      status: 'ACTIVE',
    });

    this.logger.log(`HCM accepted time-off. Ref: ${hcmReferenceId}, balance now: ${balance.balance}`);
    return { status: 'ACCEPTED', hcmReferenceId };
  }

  /**
   * Cancel time-off: restores balance.
   */
  cancelTimeOff(hcmReferenceId: string): { status: 'CONFIRMED' | 'REJECTED'; message?: string } {
    const timeOff = this.timeOffs.get(hcmReferenceId);
    if (!timeOff) {
      return { status: 'REJECTED', message: 'Time-off record not found in HCM' };
    }

    if (timeOff.status === 'CANCELLED') {
      return { status: 'REJECTED', message: 'Time-off already cancelled in HCM' };
    }

    // Restore balance
    const key = `${timeOff.employeeId}:${timeOff.locationId}`;
    const balance = this.balances.get(key);
    if (balance) {
      balance.balance += timeOff.daysRequested;
      balance.updatedAt = DateUtil.nowISO();
    }

    timeOff.status = 'CANCELLED';
    this.logger.log(`HCM cancelled time-off. Ref: ${hcmReferenceId}`);
    return { status: 'CONFIRMED' };
  }

  /**
   * Get full batch dump of all balances.
   */
  getBatchDump(): {
    generatedAt: string;
    generatedAtTimestamp: number;
    balances: { employeeId: string; locationId: string; balance: number }[];
  } {
    const balances = Array.from(this.balances.values()).map((b) => ({
      employeeId: b.employeeId,
      locationId: b.locationId,
      balance: b.balance,
    }));

    return {
      generatedAt: DateUtil.nowISO(),
      generatedAtTimestamp: DateUtil.nowTimestamp(),
      balances,
    };
  }

  /**
   * Reset all data (for tests).
   */
  reset(): void {
    this.balances.clear();
    this.timeOffs.clear();
  }
}
