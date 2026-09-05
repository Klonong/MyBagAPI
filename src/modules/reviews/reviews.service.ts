import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate } from '../../common/utils/pagination.util';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const reviewInclude = {
  users: { select: { id: true, name: true } },
};
type ReviewWithUser = Prisma.product_reviewsGetPayload<{
  include: typeof reviewInclude;
}>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: string, query: ReviewQueryDto) {
    const where: Prisma.product_reviewsWhereInput = { product_id: productId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product_reviews.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
        include: reviewInclude,
      }),
      this.prisma.product_reviews.count({ where }),
    ]);
    return paginate(
      items.map((item) => this.serialize(item)),
      query.page,
      query.limit,
      total,
    );
  }

  async create(productId: string, userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    try {
      const review = await this.prisma.product_reviews.create({
        data: {
          product_id: productId,
          user_id: userId,
          rating: dto.rating,
          comment: dto.comment,
        },
        include: reviewInclude,
      });
      return this.serialize(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw error;
    }
  }

  async update(
    productId: string,
    userId: string,
    id: number,
    dto: UpdateReviewDto,
  ) {
    const reviewId = BigInt(id);
    const existing = await this.prisma.product_reviews.findFirst({
      where: { id: reviewId, product_id: productId, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const review = await this.prisma.product_reviews.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
      include: reviewInclude,
    });
    return this.serialize(review);
  }

  async remove(productId: string, userId: string, role: string, id: number) {
    const reviewId = BigInt(id);
    const existing = await this.prisma.product_reviews.findFirst({
      where: { id: reviewId, product_id: productId },
    });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }
    if (existing.user_id !== userId && role !== 'admin') {
      throw new ForbiddenException('You can only delete your own review');
    }

    await this.prisma.product_reviews.delete({ where: { id: reviewId } });
    return { deleted: true };
  }

  private serialize(review: ReviewWithUser) {
    return {
      id: Number(review.id),
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      user: { id: review.users.id, name: review.users.name },
    };
  }
}
