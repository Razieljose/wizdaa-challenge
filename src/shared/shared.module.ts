import { Module, Global } from '@nestjs/common';

/**
 * Shared module providing global abstractions, utilities, and filters.
 * Marked as @Global so its exports are available across the application.
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class SharedModule {}
