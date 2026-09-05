import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { handlePrismaError } from '../../common/utils/prisma-error.util';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  getAddresses(userId: string) {
    return this.prisma.addresses.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const data: Prisma.addressesUncheckedCreateInput = {
      user_id: userId,
      label: dto.label,
      recipient_name: dto.recipientName,
      phone: dto.phone,
      address_line: dto.addressLine,
      address_line2: dto.addressLine2,
      city: dto.city,
      province: dto.province,
      postal_code: dto.postalCode,
      country: dto.country,
      is_default: dto.isDefault,
    };

    if (dto.isDefault) {
      const [, address] = await this.prisma.$transaction([
        this.prisma.addresses.updateMany({
          where: { user_id: userId },
          data: { is_default: false },
        }),
        this.prisma.addresses.create({ data }),
      ]);
      return address;
    }

    return this.prisma.addresses.create({ data });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.addresses.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    const data: Prisma.addressesUpdateInput = {
      ...(dto.label !== undefined && { label: dto.label }),
      ...(dto.recipientName !== undefined && {
        recipient_name: dto.recipientName,
      }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.addressLine !== undefined && { address_line: dto.addressLine }),
      ...(dto.addressLine2 !== undefined && {
        address_line2: dto.addressLine2,
      }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.province !== undefined && { province: dto.province }),
      ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
      ...(dto.country !== undefined && { country: dto.country }),
    };

    if (dto.isDefault) {
      const [, address] = await this.prisma.$transaction([
        this.prisma.addresses.updateMany({
          where: { user_id: userId, id: { not: id } },
          data: { is_default: false },
        }),
        this.prisma.addresses.update({
          where: { id },
          data: { ...data, is_default: true },
        }),
      ]);
      return address;
    }

    return this.prisma.addresses.update({ where: { id }, data });
  }

  async setDefault(userId: string, id: string) {
    const existing = await this.prisma.addresses.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    const [, address] = await this.prisma.$transaction([
      this.prisma.addresses.updateMany({
        where: { user_id: userId, id: { not: id } },
        data: { is_default: false },
      }),
      this.prisma.addresses.update({
        where: { id },
        data: { is_default: true },
      }),
    ]);
    return address;
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.addresses.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    try {
      await this.prisma.addresses.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      handlePrismaError(error, {
        notFound: 'Address not found',
        restricted: 'Address is still referenced by an existing order',
      });
    }
  }
}
