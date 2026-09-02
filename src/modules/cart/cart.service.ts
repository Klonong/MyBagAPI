import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const cartItemInclude = {
  products: {
    include: {
      categories: true,
      badges: true,
      product_images: true,
      product_colors: { include: { product_color_images: true } },
    },
  },
  product_colors: { include: { product_color_images: true } },
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.prisma.carts.findUnique({
      where: { user_id: userId },
      include: {
        cart_items: {
          include: cartItemInclude,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!cart) {
      return this.toJsonSafe({ id: null, items: [], subtotal: 0, totalItems: 0 });
    }

    const items = cart.cart_items.map((item) => this.serializeCartItem(item));
    const subtotal = items.reduce(
      (sum, item) => sum + item.product.finalPrice * item.quantity,
      0,
    );

    return this.toJsonSafe({
      id: cart.id,
      items,
      subtotal,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.ensureCart(userId);
    await this.ensureProductExists(dto.productId);

    if (dto.colorId !== undefined) {
      await this.ensureProductColor(dto.productId, dto.colorId);
    }

    const existingItem = await this.prisma.cart_items.findFirst({
      where: {
        cart_id: cart.id,
        product_id: dto.productId,
        ...(dto.colorId !== undefined && {
          color_id: BigInt(dto.colorId),
        }),
      },
      include: cartItemInclude,
    });

    if (existingItem) {
      const updatedItem = await this.prisma.cart_items.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity },
        include: cartItemInclude,
      });

      return this.toJsonSafe(this.serializeCartItem(updatedItem));
    }

    const createdItem = await this.prisma.cart_items.create({
      data: {
        cart_id: cart.id,
        product_id: dto.productId,
        quantity: dto.quantity,
        ...(dto.colorId !== undefined && { color_id: BigInt(dto.colorId) }),
      },
      include: cartItemInclude,
    });

    return this.toJsonSafe(this.serializeCartItem(createdItem));
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cart_items.findFirst({
      where: { id: itemId, cart_id: { in: [await this.getCartId(userId)] } },
      include: cartItemInclude,
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const updatedItem = await this.prisma.cart_items.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
      include: cartItemInclude,
    });

    return this.toJsonSafe(this.serializeCartItem(updatedItem));
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cart_items.findFirst({
      where: { id: itemId, cart_id: { in: [await this.getCartId(userId)] } },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cart_items.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  private async getCartId(userId: string) {
    const cart = await this.prisma.carts.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart.id;
  }

  private async ensureCart(userId: string) {
    return this.prisma.carts.upsert({
      where: { user_id: userId },
      update: {},
      create: { user_id: userId },
    });
  }

  private async ensureProductExists(productId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async ensureProductColor(productId: string, colorId: number) {
    const color = await this.prisma.product_colors.findFirst({
      where: {
        id: BigInt(colorId),
        product_id: productId,
      },
    });

    if (!color) {
      throw new NotFoundException('Product color not found');
    }
  }

  private toJsonSafe(value: any): any {
    return JSON.parse(
      JSON.stringify(value, (_key, val) =>
        typeof val === 'bigint' ? Number(val) : val,
      ),
    );
  }

  private serializeCartItem(item: any) {
    const product = this.toJsonSafe(item.products);
    const { category_id: _categoryId, badge_id: _badgeId, ...safeProduct } = product;
    const price = Number(product.price);
    const discount = Number(product.discount ?? 0);
    const finalPrice = discount > 0 ? price - discount : price;

    const response = {
      id: item.id,
      quantity: item.quantity,
      product: {
        ...safeProduct,
        price,
        discount,
        finalPrice,
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
      color: item.product_colors
        ? {
            ...this.toJsonSafe(item.product_colors),
            id: Number(item.product_colors.id),
            stock: Number(item.product_colors.stock),
            product_color_images: (item.product_colors.product_color_images ?? []).map(
              (image: any) => ({
                ...this.toJsonSafe(image),
                id: Number(image.id),
              }),
            ),
          }
        : null,
    };

    return this.toJsonSafe(response);
  }
}
