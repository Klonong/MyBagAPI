import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';

@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.badges
      .findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      })
      .then((badges) => badges.map((badge) => this.serialize(badge)));
  }

  async findOne(id: number) {
    const badge = await this.prisma.badges.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { products: true } } },
    });
    if (!badge) {
      throw new NotFoundException('Badge not found');
    }
    return this.serialize(badge);
  }

  async create(dto: CreateBadgeDto) {
    try {
      const badge = await this.prisma.badges.create({ data: dto });
      return this.serialize(badge);
    } catch (error) {
      this.handlePrismaError(error, 'Badge name is already in use');
    }
  }

  async update(id: number, dto: UpdateBadgeDto) {
    try {
      const badge = await this.prisma.badges.update({
        where: { id: BigInt(id) },
        data: dto,
      });
      return this.serialize(badge);
    } catch (error) {
      this.handlePrismaError(
        error,
        'Badge not found or name is already in use',
      );
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.badges.delete({ where: { id: BigInt(id) } });
      return { deleted: true };
    } catch (error) {
      this.handlePrismaError(
        error,
        'Badge not found or still assigned to products',
      );
    }
  }

  private handlePrismaError(error: unknown, conflictMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2003')
    ) {
      throw new ConflictException(conflictMessage);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Badge not found');
    }
    throw error;
  }

  private serialize<T extends { id: bigint; _count?: { products: number } }>(
    badge: T,
  ) {
    return {
      ...badge,
      id: Number(badge.id),
      productCount: badge._count?.products ?? 0,
    };
  }
}
