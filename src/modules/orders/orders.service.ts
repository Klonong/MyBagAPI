import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/serialize.util';
import { paginate } from '../../common/utils/pagination.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

export interface CouponResult {
  valid: boolean;
  discountAmount: number;
  message: string;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: OrderQueryDto) {
    const where: Prisma.ordersWhereInput = {
      user_id: userId,
      ...(query.status && { order_statuses: { code: query.status } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.orders.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
        include: { order_statuses: true, shipping_methods: true },
      }),
      this.prisma.orders.count({ where }),
    ]);
    return paginate(
      items.map((item) => this.serializeOrder(item)),
      query.page,
      query.limit,
      total,
    );
  }

  async findOne(userId: string, id: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id, user_id: userId },
      include: {
        addresses: true,
        order_statuses: true,
        shipping_methods: true,
        order_items: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.serializeOrder(order);
  }

  async preview(userId: string, dto: CreateOrderDto) {
    const { subtotal, shippingFee, tax, discount, total } =
      await this.computeTotals(userId, dto);
    return { subtotal, shippingFee, tax, discount, total };
  }

  async validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
    const discount = await this.prisma.discounts.findUnique({
      where: { code },
    });
    if (!discount || !discount.is_active) {
      return {
        valid: false,
        discountAmount: 0,
        message: 'Invalid coupon code',
      };
    }

    const now = new Date();
    if (now < discount.starts_at || now > discount.ends_at) {
      return {
        valid: false,
        discountAmount: 0,
        message: 'Coupon is not currently active',
      };
    }

    const value = Number(discount.value);
    const discountAmount =
      discount.type === 'percentage'
        ? Math.min(subtotal, (subtotal * value) / 100)
        : Math.min(subtotal, value);

    return { valid: true, discountAmount, message: 'Coupon applied' };
  }

  async createSummary(userId: string, dto: CreateOrderDto) {
    const {
      cartItems,
      shippingMethod,
      subtotal,
      shippingFee,
      tax,
      discount,
      total,
    } = await this.computeTotals(userId, dto);

    const order = await this.prisma.orders.create({
      data: {
        users: { connect: { id: userId } },
        ...(dto.addressId && {
          addresses: { connect: { id: dto.addressId } },
        }),
        shipping_methods: { connect: { id: shippingMethod.id } },
        delivery_method: shippingMethod.code,
        payment_method: dto.paymentMethod ?? 'card',
        subtotal,
        shipping_fee: shippingFee,
        tax,
        discount,
        total,
        order_statuses: { connect: { code: 'pending' } },
        order_items: {
          create: cartItems.map((item) => {
            const price = Number(item.products.price);
            const itemDiscount = Number(item.products.discount ?? 0);
            const unitPrice = price - itemDiscount;
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

    return toJsonSafe({
      ...order,
      status: order.order_statuses.code,
      order_statuses: undefined,
    });
  }

  private async computeTotals(userId: string, dto: CreateOrderDto) {
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
      throw new BadRequestException(
        'One or more selected cart items are invalid',
      );
    }

    if (dto.addressId) {
      const address = await this.prisma.addresses.findFirst({
        where: { id: dto.addressId, user_id: userId },
        select: { id: true },
      });
      if (!address) {
        throw new BadRequestException(
          'Address does not belong to the current user',
        );
      }
    }

    const subtotal = cartItems.reduce((sum, item) => {
      const price = Number(item.products.price);
      const discount = Number(item.products.discount ?? 0);
      return sum + (price - discount) * item.quantity;
    }, 0);
    const shippingMethodCode = dto.deliveryMethod ?? 'standard';
    const shippingMethod = await this.prisma.shipping_methods.findUnique({
      where: { code: shippingMethodCode },
    });

    if (!shippingMethod || !shippingMethod.is_active) {
      throw new BadRequestException('Shipping method is not available');
    }

    const shippingFee = Number(shippingMethod.fee);
    const tax = subtotal * 0.05;

    let discount = 0;
    if (dto.couponCode) {
      const coupon = await this.validateCoupon(dto.couponCode, subtotal);
      if (!coupon.valid) {
        throw new BadRequestException(coupon.message);
      }
      discount = coupon.discountAmount;
    }

    const total = subtotal + shippingFee + tax - discount;

    return {
      cart,
      cartItems,
      shippingMethod,
      subtotal,
      shippingFee,
      tax,
      discount,
      total,
    };
  }

  private serializeOrder(order: unknown) {
    const value = toJsonSafe(order) as Record<string, unknown>;
    for (const field of [
      'subtotal',
      'shipping_fee',
      'tax',
      'discount',
      'total',
    ]) {
      if (value[field] !== undefined) {
        value[field] = Number(value[field]);
      }
    }
    return value;
  }
}
