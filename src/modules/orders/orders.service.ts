import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createSummary(userId: string, dto: CreateOrderDto) {
    const cart = await this.prisma.carts.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const itemIds = [...new Set(dto.cartItemIds)];
    const cartItems = await this.prisma.cart_items.findMany({
      where: { id: { in: itemIds }, cart_id: cart.id },
      include: { products: true, product_colors: true },
    });

    if (cartItems.length !== itemIds.length) {
      throw new BadRequestException('One or more selected cart items are invalid');
    }

    if (dto.addressId) {
      const address = await this.prisma.addresses.findFirst({
        where: { id: dto.addressId, user_id: userId },
        select: { id: true },
      });
      if (!address) {
        throw new BadRequestException('Address does not belong to the current user');
      }
    }

    const subtotal = cartItems.reduce((sum, item) => {
      const price = Number(item.products.price);
      const discount = Number(item.products.discount ?? 0);
      return sum + (price - discount) * item.quantity;
    }, 0);
    const shippingFee = dto.deliveryMethod === 'express' ? 25 : 0;
    const tax = subtotal * 0.11;
    const total = subtotal + shippingFee + tax;

    const order = await this.prisma.orders.create({
      data: {
        users: { connect: { id: userId } },
        ...(dto.addressId && {
          addresses: { connect: { id: dto.addressId } },
        }),
        delivery_method: dto.deliveryMethod ?? 'standard',
        payment_method: dto.paymentMethod ?? 'card',
        subtotal,
        shipping_fee: shippingFee,
        tax,
        total,
        order_statuses: { connect: { code: 'pending' } },
        order_items: {
          create: cartItems.map((item) => {
            const price = Number(item.products.price);
            const discount = Number(item.products.discount ?? 0);
            const unitPrice = price - discount;
            return {
              product_id: item.product_id,
              color_id: item.color_id,
              product_name: item.products.name,
              color_name: item.product_colors?.name,
              unit_price: unitPrice,
              quantity: item.quantity,
              subtotal: unitPrice * item.quantity,
            };
          }),
        },
      },
      include: { order_statuses: true, order_items: true },
    });

    return this.toJsonSafe({
      ...order,
      status: order.order_statuses.code,
      order_statuses: undefined,
    });
  }

  private toJsonSafe(value: unknown) {
    return JSON.parse(
      JSON.stringify(value, (_key, item) =>
        typeof item === 'bigint' ? Number(item) : item,
      ),
    );
  }
}