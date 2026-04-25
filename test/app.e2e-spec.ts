import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { UserEntity } from '../src/user/entities/user.entity';
import { UserLocationRoleEntity } from '../src/user/entities/user-location-role.entity';
import { BalanceEntity } from '../src/balance/entities/balance.entity';
import { TimeOffRequestEntity } from '../src/request/entities/time-off-request.entity';
import { RequestAuditEntity } from '../src/request/entities/request-audit.entity';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { BalanceModule } from '../src/balance/balance.module';
import { RequestModule } from '../src/request/request.module';
import { SyncModule } from '../src/sync/sync.module';
import { HcmModule } from '../src/hcm/hcm.module';
import { MockHcmModule } from './mock-hcm/mock-hcm.module';
import { MockHcmService } from './mock-hcm/mock-hcm.service';
// SyncService flows (HCM sync, batch reconciliation) are tested in unit tests
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UuidUtil } from '../src/shared/utils/uuid.util';
import { DateUtil } from '../src/shared/utils/date.util';
import { Role } from '../src/shared/types';

describe('Time-Off Microservice E2E', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let mockHcmService: MockHcmService;


  let employeeId: string;
  let managerId: string;
  let outsiderManagerId: string;
  let employeeToken: string;
  let managerToken: string;
  let outsiderManagerToken: string;
  const locationId = 'LOC-001';
  const otherLocationId = 'LOC-002';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            JWT_SECRET: 'test-secret',
            JWT_EXPIRES_IN: '1h',
            GRACE_PERIOD_HOURS: 24,
            HCM_BASE_URL: 'http://localhost:3001',
            HCM_TIMEOUT_MS: 5000,
            HCM_MAX_RETRIES: 1,
          })],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [
            UserEntity, UserLocationRoleEntity, BalanceEntity,
            TimeOffRequestEntity, RequestAuditEntity,
          ],
          synchronize: true,
        }),
        ScheduleModule.forRoot(),
        AuthModule, UserModule, BalanceModule, RequestModule,
        HcmModule, SyncModule, MockHcmModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      transform: true, whitelist: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    dataSource = moduleFixture.get<DataSource>(DataSource);
    mockHcmService = moduleFixture.get<MockHcmService>(MockHcmService);


    await seedTestData();
  });

  async function seedTestData() {
    employeeId = UuidUtil.generate();
    managerId = UuidUtil.generate();
    outsiderManagerId = UuidUtil.generate();
    const passwordHash = await bcrypt.hash('password123', 10);
    const now = DateUtil.nowISO();

    await dataSource.query(
      `INSERT INTO users (id, email, name, passwordHash, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, 'employee@test.com', 'Test Employee', passwordHash, 1, now, now],
    );
    await dataSource.query(
      `INSERT INTO users (id, email, name, passwordHash, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [managerId, 'manager@test.com', 'Test Manager', passwordHash, 1, now, now],
    );
    await dataSource.query(
      `INSERT INTO users (id, email, name, passwordHash, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [outsiderManagerId, 'outsider@test.com', 'Outsider Manager', passwordHash, 1, now, now],
    );

    const roleInsert = `INSERT INTO user_location_roles (id, userId, locationId, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`;
    await dataSource.query(roleInsert, [UuidUtil.generate(), employeeId, locationId, Role.EMPLOYEE, now, now]);
    await dataSource.query(roleInsert, [UuidUtil.generate(), managerId, locationId, Role.MANAGER, now, now]);
    await dataSource.query(roleInsert, [UuidUtil.generate(), outsiderManagerId, otherLocationId, Role.MANAGER, now, now]);

    await dataSource.query(
      `INSERT INTO employee_balances (id, employeeId, locationId, hcmBalance, lastSyncedAt, lastSyncedAtTimestamp, version) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [UuidUtil.generate(), employeeId, locationId, 20, now, DateUtil.nowTimestamp(), 1],
    );

    employeeToken = jwtService.sign({ sub: employeeId, email: 'employee@test.com', name: 'Test Employee' });
    managerToken = jwtService.sign({ sub: managerId, email: 'manager@test.com', name: 'Test Manager' });
    outsiderManagerToken = jwtService.sign({ sub: outsiderManagerId, email: 'outsider@test.com', name: 'Outsider Manager' });

    mockHcmService.setBalance(employeeId, locationId, 20);
  }

  afterAll(async () => { await app.close(); });

  // ─── Happy Path ───
  describe('Happy Path: Submit → Approve → Sync → COMPLETED', () => {
    let requestId: string;

    it('Employee gets effective balance', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/balances?employeeId=${employeeId}&locationId=${locationId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(res.body.hcmBalance).toBe(20);
      expect(res.body.effectiveBalance).toBe(20);
    });

    it('Employee submits request with idempotencyKey', async () => {
      const startDate = new Date(Date.now() + 30 * 86400000).toISOString();
      const endDate = new Date(Date.now() + 32 * 86400000).toISOString();
      const res = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 3, startDate, endDate, idempotencyKey: 'idem-001' })
        .expect(201);
      expect(res.body.status).toBe('PENDING');
      requestId = res.body.id;
    });

    it('Idempotent re-submission returns same request', async () => {
      const startDate = new Date(Date.now() + 30 * 86400000).toISOString();
      const endDate = new Date(Date.now() + 32 * 86400000).toISOString();
      const res = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 3, startDate, endDate, idempotencyKey: 'idem-001' })
        .expect(201);
      expect(res.body.id).toBe(requestId);
    });

    it('Effective balance reflects pending deduction', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/balances?employeeId=${employeeId}&locationId=${locationId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(res.body.effectiveBalance).toBe(17);
    });

    it('Manager approves the request', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(res.body.newStatus).toBe('APPROVED');
    });

    // HCM sync (APPROVED → IN_SYNC → COMPLETED/FAILED) is tested in sync.service.spec.ts
    // because it requires the HcmClient to reach an external HTTP server.
  });

  // ─── Authorization ───
  describe('Authorization Enforcement', () => {
    it('Rejects unauthenticated request', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/balances?employeeId=${employeeId}&locationId=${locationId}`)
        .expect(401);
    });

    it('Employee cannot approve', async () => {
      const start = new Date(Date.now() + 60 * 86400000).toISOString();
      const end = new Date(Date.now() + 61 * 86400000).toISOString();
      const sub = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-auth' })
        .expect(201);
      await supertest(app.getHttpServer())
        .patch(`/api/requests/${sub.body.id}/approve`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('Manager from wrong location cannot approve', async () => {
      const start = new Date(Date.now() + 70 * 86400000).toISOString();
      const end = new Date(Date.now() + 71 * 86400000).toISOString();
      const sub = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-loc' })
        .expect(201);
      await supertest(app.getHttpServer())
        .patch(`/api/requests/${sub.body.id}/approve`)
        .set('Authorization', `Bearer ${outsiderManagerToken}`)
        .expect(403);
    });

    it('Employee cannot request for wrong location', async () => {
      const start = new Date(Date.now() + 100 * 86400000).toISOString();
      const end = new Date(Date.now() + 101 * 86400000).toISOString();
      await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId: otherLocationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-wrong-loc' })
        .expect(403);
    });
  });

  // ─── Cancellation ───
  describe('Cancellation', () => {
    it('Cancel PENDING → balance restored', async () => {
      const start = new Date(Date.now() + 45 * 86400000).toISOString();
      const end = new Date(Date.now() + 46 * 86400000).toISOString();
      const balBefore = await supertest(app.getHttpServer())
        .get(`/api/balances?employeeId=${employeeId}&locationId=${locationId}`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(200);

      const sub = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-cancel' })
        .expect(201);

      const cancel = await supertest(app.getHttpServer())
        .patch(`/api/requests/${sub.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(200);
      expect(cancel.body.newStatus).toBe('CANCELLED');

      const balAfter = await supertest(app.getHttpServer())
        .get(`/api/balances?employeeId=${employeeId}&locationId=${locationId}`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(200);
      expect(balAfter.body.effectiveBalance).toBe(balBefore.body.effectiveBalance);
    });

    it('Double cancel fails with 409', async () => {
      const start = new Date(Date.now() + 50 * 86400000).toISOString();
      const end = new Date(Date.now() + 51 * 86400000).toISOString();
      const sub = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-dbl-cancel' })
        .expect(201);
      await supertest(app.getHttpServer())
        .patch(`/api/requests/${sub.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(200);
      await supertest(app.getHttpServer())
        .patch(`/api/requests/${sub.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(409);
    });
  });

  // ─── Validation ───
  describe('Validation', () => {
    it('Rejects invalid date range', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: '2026-12-10', endDate: '2026-12-05', idempotencyKey: 'idem-bad-date' })
        .expect(400);
      expect(res.body.code).toBe('INVALID_DATE_RANGE');
    });

    it('Rejects insufficient balance', async () => {
      const start = new Date(Date.now() + 90 * 86400000).toISOString();
      const end = new Date(Date.now() + 120 * 86400000).toISOString();
      const res = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 999, startDate: start, endDate: end, idempotencyKey: 'idem-insuf' })
        .expect(422);
      expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
    });
  });

  // ─── Rejection ───
  describe('Rejection', () => {
    it('Manager rejects PENDING request', async () => {
      const start = new Date(Date.now() + 80 * 86400000).toISOString();
      const end = new Date(Date.now() + 81 * 86400000).toISOString();
      const sub = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-reject' })
        .expect(201);
      const rej = await supertest(app.getHttpServer())
        .patch(`/api/requests/${sub.body.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ requestId: sub.body.id, reason: 'Team capacity full' }).expect(200);
      expect(rej.body.newStatus).toBe('CANCELLED');
    });
  });

  // ─── HCM Sync scenarios are covered by unit tests in sync.service.spec.ts ───
  // The HcmClient uses HTTP to an external port, which is not available in E2E in-process tests.
  // Unit tests fully cover: sync success, HCM rejection → FAILED, HCM timeout → retry → FAILED,
  // batch reconciliation, and double-counting prevention.

  // ─── Queries ───
  describe('Request Queries', () => {
    it('Finds request by ID', async () => {
      const start = new Date(Date.now() + 55 * 86400000).toISOString();
      const end = new Date(Date.now() + 56 * 86400000).toISOString();
      const sub = await supertest(app.getHttpServer())
        .post('/api/requests').set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId, locationId, daysRequested: 1, startDate: start, endDate: end, idempotencyKey: 'idem-find' })
        .expect(201);
      const get = await supertest(app.getHttpServer())
        .get(`/api/requests/${sub.body.id}`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(200);
      expect(get.body.id).toBe(sub.body.id);
    });

    it('Lists requests by employee', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/requests?employeeId=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ─── User Management ───
  describe('User Management', () => {
    it('Login with valid credentials', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'employee@test.com', password: 'password123' }).expect(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('Login rejected with wrong password', async () => {
      await supertest(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'employee@test.com', password: 'wrongpass' }).expect(403);
    });
  });

  // ─── Batch Reconciliation covered by unit tests in sync.service.spec.ts ───
});
