import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import type { JwtPayload } from '../types/authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const token = (request.cookies as Record<string, string> | undefined)?.[
      ACCESS_TOKEN_COOKIE
    ];

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.sessions.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session || session.revoked_at) {
      throw new UnauthorizedException();
    }

    void this.prisma.sessions
      .update({
        where: { id: session.id },
        data: { last_seen_at: new Date() },
      })
      .catch(() => undefined);

    request.user = payload;
    return true;
  }
}
