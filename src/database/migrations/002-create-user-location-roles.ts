import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateUserLocationRoles1700000000002 implements MigrationInterface {
  name = '002-create-user-location-roles';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_location_roles',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'userId', type: 'varchar', length: '36' },
          { name: 'locationId', type: 'varchar' },
          { name: 'role', type: 'varchar' },
          { name: 'createdAt', type: 'varchar', isNullable: true },
          { name: 'updatedAt', type: 'varchar', isNullable: true },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'updatedBy', type: 'varchar', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'user_location_roles',
      new TableIndex({ columnNames: ['userId', 'locationId', 'role'], isUnique: true }),
    );
    await queryRunner.createIndex('user_location_roles', new TableIndex({ columnNames: ['userId'] }));
    await queryRunner.createIndex('user_location_roles', new TableIndex({ columnNames: ['locationId', 'role'] }));

    await queryRunner.createForeignKey(
      'user_location_roles',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_location_roles');
  }
}
