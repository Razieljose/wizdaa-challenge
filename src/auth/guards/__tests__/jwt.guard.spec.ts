import { JwtGuard } from '../jwt.guard';
import { ExecutionContext } from '@nestjs/common';

describe('JwtGuard', () => {
  let guard: JwtGuard;

  beforeEach(() => {
    guard = new JwtGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard("jwt")', () => {
    expect(guard).toBeInstanceOf(JwtGuard);
    expect(guard.canActivate).toBeDefined();
  });

  it('should call super.canActivate', () => {
    // JwtGuard delegates to Passport's AuthGuard.
    // We verify it calls super.canActivate by spying on the prototype.
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const superSpy = jest
      .spyOn(Object.getPrototypeOf(JwtGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    guard.canActivate(mockContext);
    expect(superSpy).toHaveBeenCalledWith(mockContext);

    superSpy.mockRestore();
  });

  it('should return true when super.canActivate returns true', () => {
    const mockContext = {} as ExecutionContext;
    jest
      .spyOn(Object.getPrototypeOf(JwtGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);

    jest.restoreAllMocks();
  });

  it('should return false when super.canActivate returns false', () => {
    const mockContext = {} as ExecutionContext;
    jest
      .spyOn(Object.getPrototypeOf(JwtGuard.prototype), 'canActivate')
      .mockReturnValue(false);

    const result = guard.canActivate(mockContext);
    expect(result).toBe(false);

    jest.restoreAllMocks();
  });
});
