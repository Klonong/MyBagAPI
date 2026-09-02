import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ProductPaginationDto,
  ProductSort,
} from './dto/product-pagination.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productInclude = {
  categories: true,
  badges: true,
  product_images: true,
  product_colors: { include: { product_color_images: true } },
};
type ProductWithRelations = Prisma.productsGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ProductPaginationDto) {
    const { page, limit, sort = ProductSort.NEWEST } = filters;
    const where = this.buildWhere(filters);

    if (sort === ProductSort.BEST_SELLER) {
      return this.findBestSellers(where, page, limit);
    }

    const orderBy =
      sort === ProductSort.PRICE_ASC
        ? { price: 'asc' as const }
        : sort === ProductSort.PRICE_DESC
          ? { price: 'desc' as const }
          : { created_at: 'desc' as const };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.products.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: productInclude,
        orderBy,
      }),
      this.prisma.products.count({ where }),
    ]);

    return this.paginatedResponse(products, page, limit, total);
  }

  private async findBestSellers(
    where: Prisma.productsWhereInput,
    page: number,
    limit: number,
  ) {
    const matchingProducts = await this.prisma.products.findMany({
      where,
      select: { id: true },
    });
    const matchingIds = matchingProducts.map((product) => product.id);
    const sales = await this.prisma.order_items.groupBy({
      by: ['product_id'],
      where: {
        product_id: { in: matchingIds },
        orders: { order_statuses: { code: { not: 'cancelled' } } },
      },
      _sum: { quantity: true },
    });
    const salesByProduct = new Map(
      sales.map((sale) => [sale.product_id, sale._sum?.quantity ?? 0]),
    );
    const sortedIds = matchingIds.sort(
      (firstId, secondId) =>
        (salesByProduct.get(secondId) ?? 0) -
        (salesByProduct.get(firstId) ?? 0),
    );
    const pageIds = sortedIds.slice((page - 1) * limit, page * limit);
    const products = await this.prisma.products.findMany({
      where: { id: { in: pageIds } },
      include: productInclude,
    });
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const orderedProducts = pageIds.flatMap((id) => {
      const product = productsById.get(id);
      return product ? [product] : [];
    });

    return this.paginatedResponse(
      orderedProducts,
      page,
      limit,
      matchingIds.length,
    );
  }

  private buildWhere({
    categoryId,
    color,
    minPrice,
    maxPrice,
    search,
  }: ProductPaginationDto): Prisma.productsWhereInput {
    return {
      ...(categoryId !== undefined && { category_id: BigInt(categoryId) }),
      ...(color && {
        product_colors: {
          some: {
            OR: [
              { name: { contains: color, mode: 'insensitive' } },
              { hex_code: { equals: color, mode: 'insensitive' } },
            ],
          },
        },
      }),
      ...((minPrice !== undefined || maxPrice !== undefined) && {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
  }

  private paginatedResponse(
    products: ProductWithRelations[],
    page: number,
    limit: number,
    total: number,
  ) {
    return {
      items: products.map((product) => this.serialize(product)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.serialize(product);
  }

  async create(dto: CreateProductDto) {
    try {
      const product = await this.prisma.products.create({
        data: this.createData(dto),
        include: productInclude,
      });
      return this.serialize(product);
    } catch (error) {
      this.handleRelationError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      const product = await this.prisma.products.update({
        where: { id },
        data: this.updateData(dto),
        include: productInclude,
      });
      return this.serialize(product);
    } catch (error) {
      this.handleRelationError(error);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.products.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (this.isPrismaCode(error, 'P2025')) {
        throw new NotFoundException('Product not found');
      }
      throw error;
    }
  }

  private createData(dto: CreateProductDto): Prisma.productsCreateInput {
    return {
      name: dto.name,
      description: dto.description,
      price: dto.price,
      discount: dto.discount,
      categories: { connect: { id: BigInt(dto.categoryId) } },
      ...(dto.badgeId !== undefined && {
        badges: { connect: { id: BigInt(dto.badgeId) } },
      }),
      product_images: {
        create: dto.productImageUrls.map((image_url) => ({ image_url })),
      },
      product_colors: {
        create: dto.colors.map((color) => ({
          name: color.name,
          hex_code: color.hexCode,
          stock: BigInt(color.stock),
          product_color_images: {
            create: color.imageUrls.map((image_url) => ({ image_url })),
          },
        })),
      },
    };
  }

  private updateData(dto: UpdateProductDto): Prisma.productsUpdateInput {
    const data: Prisma.productsUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.discount !== undefined && { discount: dto.discount }),
      ...(dto.categoryId !== undefined && {
        categories: { connect: { id: BigInt(dto.categoryId) } },
      }),
      ...(dto.badgeId !== undefined && {
        badges: { connect: { id: BigInt(dto.badgeId) } },
      }),
    };

    if (dto.productImageUrls !== undefined) {
      data.product_images = {
        deleteMany: {},
        create: dto.productImageUrls.map((image_url) => ({ image_url })),
      };
    }
    if (dto.colors !== undefined) {
      data.product_colors = {
        deleteMany: {},
        create: dto.colors.map((color) => ({
          name: color.name,
          hex_code: color.hexCode,
          stock: BigInt(color.stock),
          product_color_images: {
            create: color.imageUrls.map((image_url) => ({ image_url })),
          },
        })),
      };
    }
    return data;
  }

  private handleRelationError(error: unknown): never {
    if (this.isPrismaCode(error, 'P2025')) {
      throw new NotFoundException('Product not found');
    }
    if (this.isPrismaCode(error, 'P2003')) {
      throw new BadRequestException('Category or badge not found');
    }
    throw error;
  }

  private isPrismaCode(error: unknown, code: string) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  private serialize(product: ProductWithRelations): Record<string, unknown> {
    const serialized: unknown = JSON.parse(
      JSON.stringify(product, (_key: string, value: unknown) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    );
    return serialized as Record<string, unknown>;
  }
}
