import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.categories
      .findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      })
      .then((categories) =>
        categories.map((category) => this.serialize(category)),
      );
  }

  async findOne(id: number) {
    const category = await this.prisma.categories.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.serialize(category);
  }

  async create(dto: CreateCategoryDto) {
    try {
      const category = await this.prisma.categories.create({ data: dto });
      return this.serialize(category);
    } catch (error) {
      this.handlePrismaError(error, 'Category name is already in use');
    }
  }

  async update(id: number, dto: UpdateCategoryDto) {
    try {
      const category = await this.prisma.categories.update({
        where: { id: BigInt(id) },
        data: dto,
      });
      return this.serialize(category);
    } catch (error) {
      this.handlePrismaError(
        error,
        'Category not found or name is already in use',
      );
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.categories.delete({ where: { id: BigInt(id) } });
      return { deleted: true };
    } catch (error) {
      this.handlePrismaError(error, 'Category not found or still has products');
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
      throw new NotFoundException('Category not found');
    }
    throw error;
  }

  private serialize<T extends { id: bigint; _count?: { products: number } }>(
    category: T,
  ) {
    return {
      ...category,
      id: Number(category.id),
      ...(category._count && { _count: category._count }),
    };
  }
}
