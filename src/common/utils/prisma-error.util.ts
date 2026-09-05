import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface PrismaErrorMessages {
  /** P2025 - record to update/delete/connect was not found */
  notFound?: string;
  /** P2002 - unique constraint violation */
  conflict?: string;
  /** P2003 - foreign key constraint violation on write (e.g. invalid relation id) */
  badRequest?: string;
  /** P2003 - foreign key constraint violation on delete (e.g. still referenced elsewhere) */
  restricted?: string;
}

export function handlePrismaError(
  error: unknown,
  messages: PrismaErrorMessages,
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025' && messages.notFound) {
      throw new NotFoundException(messages.notFound);
    }
    if (error.code === 'P2002' && messages.conflict) {
      throw new ConflictException(messages.conflict);
    }
    if (error.code === 'P2003') {
      if (messages.badRequest) {
        throw new BadRequestException(messages.badRequest);
      }
      if (messages.restricted) {
        throw new ConflictException(messages.restricted);
      }
    }
  }
  throw error;
}
