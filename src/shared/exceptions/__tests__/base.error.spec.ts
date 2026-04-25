import { BaseError } from '../base.error';
import { HttpStatus } from '@nestjs/common';

describe('BaseError', () => {
  it('should create an error with all required fields', () => {
    const error = new BaseError('Test message', 'TEST_CODE', HttpStatus.BAD_REQUEST, { key: 'value' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(error.details).toEqual({ key: 'value' });
    expect(error.name).toBe('BaseError');
  });

  it('should default httpStatus to 500', () => {
    const error = new BaseError('Test', 'CODE');
    expect(error.httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should default details to empty object', () => {
    const error = new BaseError('Test', 'CODE', HttpStatus.BAD_REQUEST);
    expect(error.details).toEqual({});
  });

  it('should serialize to JSON correctly', () => {
    const error = new BaseError('msg', 'CODE', 400, { foo: 'bar' });
    const json = error.toJSON();

    expect(json).toEqual({
      error: 'BaseError',
      code: 'CODE',
      message: 'msg',
      details: { foo: 'bar' },
    });
  });

  it('should have a stack trace', () => {
    const error = new BaseError('Test', 'CODE');
    expect(error.stack).toBeDefined();
  });
});
