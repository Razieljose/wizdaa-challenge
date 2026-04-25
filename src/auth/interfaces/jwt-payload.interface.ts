export interface IJwtPayload {
  sub: string;       // User ID
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}
