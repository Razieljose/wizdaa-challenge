import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTimeOffRequests1700000000004 implements MigrationInterface {
  name = '004-create-time-off-requests';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'time_off_requests',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'employeeId', type: 'varchar', length: '36' },
          { name: 'locationId', type: 'varchar' },
          { name: 'daysRequested', type: 'decimal' },
          { name: 'status', type: 'varchar' },
          { name: 'startDate', type: 'varchar' },
          { name: 'startDateTimestamp', type: 'integer' },
          { name: 'endDate', type: 'varchar' },
          { name: 'endDateTimestamp', type: 'integer' },
          { name: 'hcmReferenceId', type: 'varchar', isNullable: true },
          { name: 'rejectionReason', type: 'varchar', isNullable: true },
          { name: 'cancelledBy', type: 'varchar', isNullable: true },
          { name: 'cancelledAt', type: 'varchar', isNullable: true },
          { name: 'idempotencyKey', type: 'varchar' },
          { name: 'createdAt', type: 'varchar', isNullable: true },
          { name: 'createdAtTimestamp', type: 'integer', isNullable: true },
          { name: 'updatedAt', type: 'varchar', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('time_off_requests', new TableIndex({ columnNames: ['idempotencyKey'], isUnique: true }));
    await queryRunner.createIndex('time_off_requests', new TableIndex({ columnNames: ['employeeId', 'status'] }));
    await queryRunner.createIndex('time_off_requests', new TableIndex({ columnNames: ['status'] }));
    await queryRunner.createIndex('time_off_requests', new TableIndex({ columnNames: ['employeeId', 'startDateTimestamp', 'endDateTimestamp'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('time_off_requests');
  }
}
