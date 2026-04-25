import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IRequestService } from '../interfaces/request.service.interface';
import { RequestReadRepository } from '../repositories/request.read.repository';
import { RequestAuditRepository } from '../repositories/request-audit.repository';
import { RequestStateMachine } from './request-state-machine';
import { BalanceService } from '../../balance/services/balance.service';
import { HcmClient } from '../../hcm/hcm.client';
import { SubmitRequestInput, RequestOutput, ApproveRejectOutput } from '../dto';
import { IActor } from '../../shared/interfaces';
import { RequestStatus } from '../../shared/types';
import {
  NotFoundError,
  ForbiddenError,
  InsufficientBalanceError,
  InvalidDateRangeError,
  OverlapConflictError,
  GracePeriodExpiredError,
} from '../../shared/exceptions';
import { DateUtil } from '../../shared/utils/date.util';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { TimeOffRequestEntity } from '../entities/time-off-request.entity';
import { RequestAuditEntity } from '../entities/request-audit.entity';

@Injectable()
export class RequestService implements IRequestService {
  private readonly logger = new Logger(RequestService.name);
  private readonly gracePeriodHours: number;

  constructor(
    private readonly requestReadRepo: RequestReadRepository,
    private readonly auditRepo: RequestAuditRepository,
    private readonly stateMachine: RequestStateMachine,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClient,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.gracePeriodHours = this.configService.get<number>('GRACE_PERIOD_HOURS', 24);
  }

  /**
   * Submit a new time-off request.
   * Validates: idempotency, date range, balance, overlaps, location access.
   */
  async submit(input: SubmitRequestInput, actor: IActor): Promise<RequestOutput> {
    this.logger.log(`Submit request: employee=${input.employeeId}, key=${input.idempotencyKey}`);

    const existing = await this.requestReadRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      this.logger.debug(`Idempotent hit: returning existing request ${existing.id}`);
      return this.toOutput(existing);
    }

    if (actor.id !== input.employeeId) {
      throw new ForbiddenError('Cannot submit request for another employee', {
        actorId: actor.id,
        employeeId: input.employeeId,
      });
    }

    const hasLocationAccess = actor.roles.some((r) => r.locationId === input.locationId);
    if (!hasLocationAccess) {
      throw new ForbiddenError('No access to the specified location', {
        actorId: actor.id,
        locationId: input.locationId,
      });
    }

    if (!DateUtil.isValidDateRange(input.startDate, input.endDate)) {
      throw new InvalidDateRangeError(input.startDate, input.endDate);
    }

    const balance = await this.balanceService.getEffectiveBalance(
      input.employeeId,
      input.locationId,
    );
    if (balance.effectiveBalance < input.daysRequested) {
      throw new InsufficientBalanceError(
        input.employeeId,
        input.locationId,
        input.daysRequested,
        balance.effectiveBalance,
      );
    }

    const startTs = DateUtil.toTimestamp(input.startDate);
    const endTs = DateUtil.toTimestamp(input.endDate);
    const overlapping = await this.requestReadRepo.findOverlapping(
      input.employeeId,
      input.locationId,
      startTs,
      endTs,
      [RequestStatus.CANCELLED, RequestStatus.FAILED],
    );
    if (overlapping.length > 0) {
      throw new OverlapConflictError(
        input.employeeId,
        input.startDate,
        input.endDate,
        overlapping[0].id,
      );
    }

    const request = new TimeOffRequestEntity();
    request.id = UuidUtil.generate();
    request.employeeId = input.employeeId;
    request.locationId = input.locationId;
    request.daysRequested = input.daysRequested;
    request.status = RequestStatus.PENDING;
    request.startDate = input.startDate;
    request.startDateTimestamp = startTs;
    request.endDate = input.endDate;
    request.endDateTimestamp = endTs;
    request.idempotencyKey = input.idempotencyKey;
    request.createdAt = DateUtil.nowISO();
    request.createdAtTimestamp = DateUtil.nowTimestamp();
    request.updatedAt = DateUtil.nowISO();

    const saved = await this.saveWithAudit(
      request,
      actor.id,
      'NONE',
      RequestStatus.PENDING,
      'submit',
    );

    this.logger.log(`Request created: ${saved.id}`);
    return this.toOutput(saved);
  }

  /**
   * Approve a pending request.
   * Validates: MANAGER role, location access, grace period, state machine.
   */
  async approve(requestId: string, actor: IActor): Promise<ApproveRejectOutput> {
    this.logger.log(`Approve request: ${requestId} by ${actor.id}`);

    const request = await this.getRequestOrThrow(requestId);
    this.validateManagerAccess(actor, request.locationId);

    const previousStatus = request.status;
    this.stateMachine.validateTransition(request.status, 'approve');

    if (!DateUtil.isWithinGracePeriod(request.startDate, this.gracePeriodHours)) {
      throw new GracePeriodExpiredError(
        requestId,
        'approve',
        DateUtil.getGraceDeadline(request.startDate, this.gracePeriodHours),
      );
    }

    request.status = RequestStatus.APPROVED;
    request.updatedAt = DateUtil.nowISO();

    await this.saveWithAudit(request, actor.id, previousStatus, RequestStatus.APPROVED, 'approve');

    return {
      requestId,
      previousStatus,
      newStatus: RequestStatus.APPROVED,
      message: 'Request approved successfully',
    };
  }

  /**
   * Reject a pending request (by MANAGER).
   */
  async reject(requestId: string, reason: string, actor: IActor): Promise<ApproveRejectOutput> {
    this.logger.log(`Reject request: ${requestId} by ${actor.id}`);

    const request = await this.getRequestOrThrow(requestId);
    this.validateManagerAccess(actor, request.locationId);

    const previousStatus = request.status;
    this.stateMachine.validateTransition(request.status, 'reject');

    request.status = RequestStatus.CANCELLED;
    request.rejectionReason = reason || 'Rejected by manager';
    request.updatedAt = DateUtil.nowISO();

    await this.saveWithAudit(
      request,
      actor.id,
      previousStatus,
      RequestStatus.CANCELLED,
      'reject',
      reason,
    );

    return {
      requestId,
      previousStatus,
      newStatus: RequestStatus.CANCELLED,
      message: 'Request rejected',
    };
  }

  /**
   * Cancel a request.
   * COMPLETED → CANCELLED requires HCM reversal via real-time API.
   */
  async cancel(requestId: string, actor: IActor): Promise<ApproveRejectOutput> {
    this.logger.log(`Cancel request: ${requestId} by ${actor.id}`);

    const request = await this.getRequestOrThrow(requestId);

    const isOwner = actor.id === request.employeeId;
    const isManager = actor.managedLocationIds.includes(request.locationId);

    if (!isOwner && !isManager) {
      throw new ForbiddenError('Not authorized to cancel this request', {
        actorId: actor.id,
        requestId,
      });
    }

    const previousStatus = request.status;
    this.stateMachine.validateTransition(request.status, 'cancel');

    if (previousStatus === RequestStatus.APPROVED && !isManager) {
      if (!DateUtil.isWithinGracePeriod(request.startDate, this.gracePeriodHours)) {
        throw new GracePeriodExpiredError(
          requestId,
          'cancel',
          DateUtil.getGraceDeadline(request.startDate, this.gracePeriodHours),
        );
      }
    }

    // COMPLETED → CANCELLED requires HCM reversal
    if (previousStatus === RequestStatus.COMPLETED) {
      try {
        await this.hcmClient.cancelTimeOff(request.hcmReferenceId);
        this.logger.log(`HCM reversal confirmed for request ${requestId} (ref: ${request.hcmReferenceId})`);
      } catch (error: any) {
        const reason = `HCM_REVERSAL_REJECTED:${error?.message ?? 'unknown'}`;
        this.logger.error(
          `HCM reversal failed for request ${requestId} (ref: ${request.hcmReferenceId}): ${error?.message}. Flagged for manual review.`,
        );

        // Persist the flag (status stays COMPLETED) so operators can query later.
        request.manualReviewReason = reason;
        request.updatedAt = DateUtil.nowISO();
        await this.saveWithAudit(
          request,
          actor.id,
          previousStatus,
          previousStatus, // no status transition — stays COMPLETED
          'cancel_attempt_failed',
          error?.message,
        );

        throw new ForbiddenError(
          'HCM reversal rejected. Request remains COMPLETED and requires manual review.',
          { requestId, hcmReferenceId: request.hcmReferenceId, manualReviewReason: reason },
        );
      }
    }

    request.status = RequestStatus.CANCELLED;
    request.cancelledBy = actor.id;
    request.cancelledAt = DateUtil.nowISO();
    request.updatedAt = DateUtil.nowISO();

    await this.saveWithAudit(request, actor.id, previousStatus, RequestStatus.CANCELLED, 'cancel');

    return {
      requestId,
      previousStatus,
      newStatus: RequestStatus.CANCELLED,
      message: `Request cancelled from ${previousStatus}`,
    };
  }

  async findById(requestId: string): Promise<RequestOutput> {
    const request = await this.getRequestOrThrow(requestId);
    return this.toOutput(request);
  }

  async findByEmployee(employeeId: string, locationId?: string): Promise<RequestOutput[]> {
    let requests: TimeOffRequestEntity[];
    if (locationId) {
      requests = await this.requestReadRepo.findMany({ employeeId, locationId } as any);
    } else {
      requests = await this.requestReadRepo.findMany({ employeeId } as any);
    }
    return requests.map((r) => this.toOutput(r));
  }

  /**
   * Internal: APPROVED → IN_SYNC (called by SyncService).
   */
  async transitionToInSync(requestId: string): Promise<TimeOffRequestEntity> {
    const request = await this.getRequestOrThrow(requestId);
    this.stateMachine.validateTransition(request.status, 'sync');
    const previous = request.status;
    request.status = RequestStatus.IN_SYNC;
    request.updatedAt = DateUtil.nowISO();
    return this.saveWithAudit(request, 'SYSTEM', previous, RequestStatus.IN_SYNC, 'sync');
  }

  /**
   * Internal: IN_SYNC → COMPLETED (called by SyncService).
   */
  async transitionToCompleted(requestId: string, hcmReferenceId: string): Promise<TimeOffRequestEntity> {
    const request = await this.getRequestOrThrow(requestId);
    this.stateMachine.validateTransition(request.status, 'complete');
    const previous = request.status;
    request.status = RequestStatus.COMPLETED;
    request.hcmReferenceId = hcmReferenceId;
    request.updatedAt = DateUtil.nowISO();
    return this.saveWithAudit(request, 'SYSTEM', previous, RequestStatus.COMPLETED, 'complete');
  }

  /**
   * Internal: IN_SYNC → FAILED (called by SyncService).
   */
  async transitionToFailed(requestId: string, reason: string): Promise<TimeOffRequestEntity> {
    const request = await this.getRequestOrThrow(requestId);
    this.stateMachine.validateTransition(request.status, 'fail');
    const previous = request.status;
    request.status = RequestStatus.FAILED;
    request.rejectionReason = reason;
    request.updatedAt = DateUtil.nowISO();
    return this.saveWithAudit(request, 'SYSTEM', previous, RequestStatus.FAILED, 'fail', reason);
  }

  /**
   * Atomically saves a request state change and its audit log entry
   * within a single TypeORM transaction.
   */
  private async saveWithAudit(
    request: TimeOffRequestEntity,
    actorId: string,
    previousStatus: string,
    newStatus: string,
    action: string,
    reason?: string,
  ): Promise<TimeOffRequestEntity> {
    const auditEntity = this.auditRepo.buildEntity(
      request.id,
      actorId,
      previousStatus,
      newStatus,
      action,
      reason,
    );

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(TimeOffRequestEntity, request);
      await manager.save(RequestAuditEntity, auditEntity);
      return saved;
    });
  }

  private async getRequestOrThrow(requestId: string): Promise<TimeOffRequestEntity> {
    const request = await this.requestReadRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError('TimeOffRequest', requestId);
    }
    return request;
  }

  private validateManagerAccess(actor: IActor, locationId: string): void {
    const isManager = actor.managedLocationIds.includes(locationId);
    if (!isManager) {
      throw new ForbiddenError('Manager does not have access to this location', {
        actorId: actor.id,
        locationId,
      });
    }
  }

  private toOutput(entity: TimeOffRequestEntity): RequestOutput {
    const output = new RequestOutput();
    output.id = entity.id;
    output.employeeId = entity.employeeId;
    output.locationId = entity.locationId;
    output.daysRequested = Number(entity.daysRequested);
    output.status = entity.status;
    output.startDate = entity.startDate;
    output.endDate = entity.endDate;
    output.hcmReferenceId = entity.hcmReferenceId || null;
    output.rejectionReason = entity.rejectionReason || null;
    output.cancelledBy = entity.cancelledBy || null;
    output.cancelledAt = entity.cancelledAt || null;
    output.manualReviewReason = entity.manualReviewReason ?? null;
    output.idempotencyKey = entity.idempotencyKey;
    output.createdAt = entity.createdAt;
    output.updatedAt = entity.updatedAt;
    return output;
  }
}
