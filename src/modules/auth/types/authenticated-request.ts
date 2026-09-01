import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
