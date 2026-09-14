import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HomeContentService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Record<string, unknown>> {
    const row = await this.prisma.home_content.findUnique({ where: { id: 1 } });
    return (row?.content as Record<string, unknown>) ?? {};
  }

  async update(
    content: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.home_content.upsert({
      where: { id: 1 },
      create: { id: 1, content: content as Prisma.InputJsonValue },
      update: { content: content as Prisma.InputJsonValue },
    });

    return row.content as Record<string, unknown>;
  }
}
