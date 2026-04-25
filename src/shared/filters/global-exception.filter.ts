import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { BaseError } from '../exceptions/base.error';

/**
 * Global exception filter that maps BaseError subclasses to HTTP responses.
 * Also handles standard NestJS HttpExceptions and unknown errors.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof BaseError) {
      this.logger.warn(
        `[${exception.code}] ${exception.message}`,
        JSON.stringify(exception.details),
      );

      response.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        error: exception.name,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      this.logger.warn(`HttpException: ${exception.message}`);

      response.status(status).json({
        statusCode: status,
        ...(typeof exceptionResponse === 'object' ? exceptionResponse : { message: exceptionResponse }),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Unknown error - log full stack and return 500
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}
