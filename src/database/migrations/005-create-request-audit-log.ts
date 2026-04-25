import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateRequestAuditLog1700000000005 implements MigrationInterface {
  name = '005-create-request-audit-log';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'request_audit_log',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'actorId', type: 'varchar', length: '36' },
          { name: 'previousStatus', type: 'varchar' },
          { name: 'newStatus', type: 'varchar' },
          { name: 'action', type: 'varchar', isNullable: true },
          { name: 'reason', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: 'varchar' },
          { name: 'createdAtTimestamp', type: 'integer' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('request_audit_log', new TableIndex({ columnNames: ['requestId'] }));
    await queryRunner.createIndex('request_audit_log', new TableIndex({ columnNames: ['actorId'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('request_audit_log');
  }
}
