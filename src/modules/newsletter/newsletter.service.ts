import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent opt-in: re-submitting an address refreshes the source rather
   * than erroring, so the form never punishes someone for signing up twice.
   */
  async subscribe(dto: SubscribeDto) {
    const email = dto.email.trim().toLowerCase();

    return this.prisma.newsletter_subscribers.upsert({
      where: { email },
      update: { source: dto.source ?? null },
      create: { email, source: dto.source ?? null },
    });
  }

  async unsubscribe(email: string) {
    await this.prisma.newsletter_subscribers.deleteMany({
      where: { email: email.trim().toLowerCase() },
    });
    return { unsubscribed: true };
  }
}
