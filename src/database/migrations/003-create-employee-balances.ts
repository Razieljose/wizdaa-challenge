import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateEmployeeBalances1700000000003 implements MigrationInterface {
  name = '003-create-employee-balances';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'employee_balances',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'employeeId', type: 'varchar', length: '36' },
          { name: 'locationId', type: 'varchar' },
          { name: 'hcmBalance', type: 'decimal', default: 0 },
          { name: 'lastSyncedAt', type: 'varchar', isNullable: true },
          { name: 'lastSyncedAtTimestamp', type: 'integer', isNullable: true },
          { name: 'version', type: 'integer', default: 1 },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'employee_balances',
      new TableIndex({ columnNames: ['employeeId', 'locationId'], isUnique: true }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('employee_balances');
  }
}
