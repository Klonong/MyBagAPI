import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.sessions.findMany({
      where: { user_id: userId, revoked_at: null },
      orderBy: { last_seen_at: 'desc' },
    });
    return sessions.map((session) => ({
      id: session.id,
      ip: session.ip,
      userAgent: session.user_agent,
      createdAt: session.created_at,
      lastSeenAt: session.last_seen_at,
      current: session.id === currentSessionId,
    }));
  }

  async revoke(userId: string, id: string) {
    const session = await this.prisma.sessions.findFirst({
      where: { id, user_id: userId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.sessions.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
    return { revoked: true };
  }
}
