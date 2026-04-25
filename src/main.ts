import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global validation pipe with class-transformer integration
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter: maps BaseError → HTTP response
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable CORS for development
  app.enableCors();

  // Set global prefix
  app.setGlobalPrefix('api');

  // Configure SQLite WAL mode and busy_timeout after connection
  try {
    const dataSource = app.get(DataSource);
    await dataSource.query('PRAGMA journal_mode=WAL');
    await dataSource.query('PRAGMA busy_timeout=5000');
    logger.log('SQLite WAL mode and busy_timeout configured');
  } catch (error) {
    logger.warn(`Failed to set SQLite pragmas: ${error.message}`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Time-Off Microservice running on port ${port}`);
}

bootstrap();
