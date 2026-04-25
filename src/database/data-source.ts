import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ path: '.env' });

import { UserEntity } from '../user/entities/user.entity';
import { UserLocationRoleEntity } from '../user/entities/user-location-role.entity';
import { BalanceEntity } from '../balance/entities/balance.entity';
import { TimeOffRequestEntity } from '../request/entities/time-off-request.entity';
import { RequestAuditEntity } from '../request/entities/request-audit.entity';
import { CreateUsers1700000000001 } from './migrations/001-create-users';
import { CreateUserLocationRoles1700000000002 } from './migrations/002-create-user-location-roles';
import { CreateEmployeeBalances1700000000003 } from './migrations/003-create-employee-balances';
import { CreateTimeOffRequests1700000000004 } from './migrations/004-create-time-off-requests';
import { CreateRequestAuditLog1700000000005 } from './migrations/005-create-request-audit-log';
import { AddManualReviewReason1700000000006 } from './migrations/006-add-manual-review-reason';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? './data/timeoff.db',
  entities: [
    UserEntity,
    UserLocationRoleEntity,
    BalanceEntity,
    TimeOffRequestEntity,
    RequestAuditEntity,
  ],
  migrations: [
    CreateUsers1700000000001,
    CreateUserLocationRoles1700000000002,
    CreateEmployeeBalances1700000000003,
    CreateTimeOffRequests1700000000004,
    CreateRequestAuditLog1700000000005,
    AddManualReviewReason1700000000006,
  ],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
