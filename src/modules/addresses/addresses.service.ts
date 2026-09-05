import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  getAddresses(userId: string) {
    return this.prisma.addresses.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  create(userId: string, dto: CreateAddressDto) {
    return this.prisma.addresses.create({
      data: {
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
      },
    });
  }
}
