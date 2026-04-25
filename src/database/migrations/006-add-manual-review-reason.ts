import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddManualReviewReason1700000000006 implements MigrationInterface {
  name = '006-add-manual-review-reason';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'time_off_requests',
      new TableColumn({
        name: 'manualReviewReason',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Partial-index equivalent: indexes NULLs compactly in SQLite.
    // Useful for admin queries: WHERE manualReviewReason IS NOT NULL
    await queryRunner.createIndex(
      'time_off_requests',
      new TableIndex({
        name: 'IDX_time_off_requests_manualReviewReason',
        columnNames: ['manualReviewReason'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('time_off_requests', 'IDX_time_off_requests_manualReviewReason');
    await queryRunner.dropColumn('time_off_requests', 'manualReviewReason');
  }
}
