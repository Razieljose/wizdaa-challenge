import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';

const LOCATIONS = ['loc-001', 'loc-002'];

const SEED_USERS = [
  { email: 'manager@company.com', name: 'Admin Manager', role: 'MANAGER', password: 'Password123' },
  { email: 'alice@company.com',   name: 'Alice Employee', role: 'EMPLOYEE', password: 'Password123' },
  { email: 'bob@company.com',     name: 'Bob Employee',   role: 'EMPLOYEE', password: 'Password123' },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.configService.get<string>('NODE_ENV', 'development') === 'production') {
      return;
    }
    await this.seed();
  }

  async seed() {
    const already = await this.dataSource.query(`SELECT COUNT(*) as cnt FROM users`);
    if (Number(already[0].cnt) > 0) {
      this.logger.debug('Seed skipped — database already has data');
      return;
    }

    this.logger.log('Seeding database with initial data...');

    const now = DateUtil.nowISO();
    const userIds: Record<string, string> = {};

    // Create users
    for (const u of SEED_USERS) {
      const id = UuidUtil.generate();
      const hash = await bcrypt.hash(u.password, 10);
      await this.dataSource.query(
        `INSERT INTO users (id, email, name, passwordHash, isActive, createdAt, updatedAt, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, 1, ?, ?, '', '')`,
        [id, u.email, u.name, hash, now, now],
      );
      userIds[u.email] = id;
    }

    const managerId = userIds['manager@company.com'];

    // Assign roles: manager in both locations, employees in loc-001
    for (const loc of LOCATIONS) {
      await this.insertRole(managerId, loc, 'MANAGER', now);
    }
    await this.insertRole(userIds['alice@company.com'], 'loc-001', 'EMPLOYEE', now);
    await this.insertRole(userIds['bob@company.com'], 'loc-001', 'EMPLOYEE', now);

    // Create balances: 20 days for each employee per location
    for (const email of ['alice@company.com', 'bob@company.com']) {
      await this.insertBalance(userIds[email], 'loc-001', 20, now);
    }

    // Seed time-off requests in various states for alice
    const aliceId = userIds['alice@company.com'];
    await this.insertRequest(aliceId, 'loc-001', 3, 'PENDING',   '2026-06-02', '2026-06-04', now);
    await this.insertRequest(aliceId, 'loc-001', 5, 'APPROVED',  '2026-07-07', '2026-07-11', now);
    await this.insertRequest(aliceId, 'loc-001', 2, 'COMPLETED', '2026-05-05', '2026-05-06', now, 'HCM-REF-001');
    await this.insertRequest(aliceId, 'loc-001', 1, 'CANCELLED', '2026-04-01', '2026-04-01', now);

    this.logger.log('Seed completed. Credentials: Password123 for all users.');
    this.logger.log(`  manager@company.com — MANAGER in loc-001, loc-002`);
    this.logger.log(`  alice@company.com   — EMPLOYEE in loc-001`);
    this.logger.log(`  bob@company.com     — EMPLOYEE in loc-001`);
  }

  private async insertRole(userId: string, locationId: string, role: string, now: string) {
    await this.dataSource.query(
      `INSERT INTO user_location_roles (id, userId, locationId, role, createdAt, updatedAt, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, '', '')`,
      [UuidUtil.generate(), userId, locationId, role, now, now],
    );
  }

  private async insertBalance(employeeId: string, locationId: string, balance: number, now: string) {
    await this.dataSource.query(
      `INSERT INTO employee_balances (id, employeeId, locationId, hcmBalance, lastSyncedAt, lastSyncedAtTimestamp, version)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [UuidUtil.generate(), employeeId, locationId, balance, now, DateUtil.nowTimestamp()],
    );
  }

  private async insertRequest(
    employeeId: string,
    locationId: string,
    days: number,
    status: string,
    startDate: string,
    endDate: string,
    now: string,
    hcmReferenceId?: string,
  ) {
    const id = UuidUtil.generate();
    const startTs = DateUtil.toTimestamp(startDate);
    const endTs = DateUtil.toTimestamp(endDate);
    const key = `seed-${id}`;
    await this.dataSource.query(
      `INSERT INTO time_off_requests
         (id, employeeId, locationId, daysRequested, status, startDate, startDateTimestamp,
          endDate, endDateTimestamp, hcmReferenceId, idempotencyKey, createdAt, createdAtTimestamp, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, employeeId, locationId, days, status, startDate, startTs, endDate, endTs,
       hcmReferenceId ?? null, key, now, DateUtil.nowTimestamp(), now],
    );
  }
}
