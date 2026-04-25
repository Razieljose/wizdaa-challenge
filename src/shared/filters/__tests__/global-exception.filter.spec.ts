import { GlobalExceptionFilter } from '../global-exception.filter';
import { BaseError } from '../../exceptions/base.error';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test' }),
      }),
    } as any;
  });

  it('should handle BaseError and return correct status', () => {
    const error = new BaseError('Test error', 'TEST', HttpStatus.BAD_REQUEST, { key: 'val' });
    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'TEST',
        message: 'Test error',
        details: { key: 'val' },
      }),
    );
  });

  it('should handle HttpException', () => {
    const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
  });

  it('should handle unknown errors with 500', () => {
    const error = new Error('Unknown');
    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
      }),
    );
  });

  it('should handle non-Error objects', () => {
    filter.catch('string error', mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
