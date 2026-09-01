import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

const wishlistItemInclude = {
  products: {
    include: {
      categories: true,
      badges: true,
      product_images: true,
      product_colors: { include: { product_color_images: true } },
    },
  },
};

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlist_items.findMany({
      where: { user_id: userId },
      include: wishlistItemInclude,
      orderBy: { created_at: 'desc' },
    });

    return this.toJsonSafe({
      items: items.map((item) => this.serializeWishlistItem(item)),
      total: items.length,
    });
  }

  async addItem(userId: string, dto: AddWishlistItemDto) {
    const product = await this.prisma.products.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.wishlist_items.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: dto.productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product already exists in wishlist');
    }

    const item = await this.prisma.wishlist_items.create({
      data: {
        user_id: userId,
        product_id: dto.productId,
      },
      include: wishlistItemInclude,
    });

    return this.toJsonSafe(this.serializeWishlistItem(item));
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.wishlist_items.findFirst({
      where: { id: itemId, user_id: userId },
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    await this.prisma.wishlist_items.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  private toJsonSafe(value: any): any {
    return JSON.parse(
      JSON.stringify(value, (_key, val) =>
        typeof val === 'bigint' ? Number(val) : val,
      ),
    );
  }

  private serializeWishlistItem(item: any) {
    const product = this.toJsonSafe(item.products);
    const { category_id: _categoryId, badge_id: _badgeId, ...safeProduct } = product;

    const response = {
      id: item.id,
      createdAt: item.created_at,
      product: {
        ...safeProduct,
        price: Number(product.price),
        discount: product.discount ? Number(product.discount) : null,
        categoryId: product.category_id ? Number(product.category_id) : null,
        badgeId: product.badge_id ? Number(product.badge_id) : null,
        product_images: (product.product_images ?? []).map((image: any) => ({
          ...image,
          id: Number(image.id),
        })),
        product_colors: (product.product_colors ?? []).map((color: any) => ({
          ...color,
          id: Number(color.id),
          stock: Number(color.stock),
          product_color_images: (color.product_color_images ?? []).map(
            (image: any) => ({
              ...image,
              id: Number(image.id),
            }),
          ),
        })),
        categories: product.categories
          ? { ...product.categories, id: Number(product.categories.id) }
          : null,
        badges: product.badges
          ? { ...product.badges, id: Number(product.badges.id) }
          : null,
      },
    };

    return this.toJsonSafe(response);
  }
}
