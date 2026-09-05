import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AdminOrderQueryDto,
  CustomerQueryDto,
  UpdateCustomerStatusDto,
  UpdateOrderStatusDto,
  UpdateSettingsDto,
} from './dto/admin.dto';
import {
  CreateDiscountDto,
  DiscountQueryDto,
  UpdateDiscountDto,
} from './dto/discount.dto';

const allowedStatuses = [
  'pending',
  'paid',
  'shipped',
  'completed',
  'cancelled',
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listDiscounts(query: DiscountQueryDto) {
    const where: Prisma.discountsWhereInput = {
      ...(query.status && { is_active: query.status === 'active' }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.discounts.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.discounts.count({ where }),
    ]);
    return this.pageResponse(items, query.page, query.limit, total);
  }

  async getDiscount(id: string) {
    const discount = await this.prisma.discounts.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    return this.serialize(discount);
  }

  async createDiscount(dto: CreateDiscountDto) {
    if (dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    try {
      const discount = await this.prisma.discounts.create({
        data: {
          name: dto.name,
          code: dto.code,
          type: dto.type,
          value: dto.value,
          starts_at: dto.startsAt,
          ends_at: dto.endsAt,
          is_active: dto.isActive,
        },
      });
      return this.serialize(discount);
    } catch (error) {
      this.handlePrismaError(error, 'Discount code is already in use');
    }
  }

  async updateDiscount(id: string, dto: UpdateDiscountDto) {
    if (dto.startsAt && dto.endsAt && dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    try {
      const discount = await this.prisma.discounts.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.value !== undefined && { value: dto.value }),
          ...(dto.startsAt !== undefined && { starts_at: dto.startsAt }),
          ...(dto.endsAt !== undefined && { ends_at: dto.endsAt }),
          ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        },
      });
      return this.serialize(discount);
    } catch (error) {
      this.handlePrismaError(
        error,
        'Discount not found or code is already in use',
      );
    }
  }

  async deleteDiscount(id: string) {
    try {
      await this.prisma.discounts.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaError(error, 'Discount not found');
    }
  }

  async listOrders(query: AdminOrderQueryDto) {
    const where: Prisma.ordersWhereInput = query.status
      ? { order_statuses: { code: query.status } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.orders.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
        include: { users: true, order_statuses: true, shipping_methods: true },
      }),
      this.prisma.orders.count({ where }),
    ]);
    return this.pageResponse(
      items.map((item) => this.serializeOrder(item)),
      query.page,
      query.limit,
      total,
    );
  }

  async getOrder(id: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        users: true,
        addresses: true,
        order_statuses: true,
        shipping_methods: true,
        order_items: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serializeOrder(order);
  }

  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto) {
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException('Invalid order status');
    }
    const status = await this.prisma.order_statuses.findUnique({
      where: { code: dto.status },
    });
    if (!status)
      throw new BadRequestException('Order status is not configured');
    try {
      const order = await this.prisma.orders.update({
        where: { id },
        data: { status_id: status.id },
        include: { order_statuses: true },
      });
      return this.serialize(order);
    } catch (error) {
      this.handlePrismaError(error, 'Order not found');
    }
  }

  async listCustomers(query: CustomerQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: 'user',
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [customers, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    const items = await Promise.all(
      customers.map(async (customer) => {
        const spent = await this.prisma.orders.aggregate({
          where: { user_id: customer.id },
          _sum: { total: true },
        });
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          orderCount: customer._count.orders,
          totalSpent: Number(spent._sum.total ?? 0),
          isActive: customer.is_active,
          createdAt: customer.createdAt,
        };
      }),
    );
    return this.pageResponse(items, query.page, query.limit, total);
  }

  async getCustomer(id: string) {
    const customer = await this.prisma.user.findFirst({
      where: { id, role: 'user' },
      include: {
        addresses: true,
        orders: {
          include: { order_statuses: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.serialize(customer);
  }

  async updateCustomerStatus(id: string, dto: UpdateCustomerStatusDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: 'user' },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    try {
      const customer = await this.prisma.user.update({
        where: { id },
        data: { is_active: dto.isActive },
      });
      return { id: customer.id, isActive: customer.is_active };
    } catch (error) {
      this.handlePrismaError(error, 'Customer not found');
    }
  }

  getSettings() {
    return this.prisma.store_settings.findUnique({ where: { id: 1 } });
  }

  async updateSettings(dto: UpdateSettingsDto) {
    return this.prisma.store_settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        store_name: dto.storeName ?? 'Pioma',
        support_email: dto.supportEmail,
        currency: dto.currency ?? 'IDR',
      },
      update: {
        ...(dto.storeName !== undefined && { store_name: dto.storeName }),
        ...(dto.supportEmail !== undefined && {
          support_email: dto.supportEmail,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
    });
  }

  private pageResponse<T>(
    items: T[],
    page: number,
    limit: number,
    total: number,
  ) {
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private serialize(value: unknown): any {
    return JSON.parse(
      JSON.stringify(value, (_key, item) =>
        typeof item === 'bigint' ? Number(item) : item,
      ),
    );
  }

  private serializeOrder(order: any) {
    const value = this.serialize(order);
    for (const field of [
      'subtotal',
      'shipping_fee',
      'tax',
      'discount',
      'total',
    ]) {
      if (value[field] !== undefined) value[field] = Number(value[field]);
    }
    return value;
  }

  private handlePrismaError(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException(message);
      if (error.code === 'P2025') throw new NotFoundException(message);
    }
    throw error;
  }
}
