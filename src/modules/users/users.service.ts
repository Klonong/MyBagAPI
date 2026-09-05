import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(requesterId: string, requesterRole: string, id: string) {
    this.assertCanAccess(requesterId, requesterRole, id);

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.serialize(user);
  }

  async update(
    requesterId: string,
    requesterRole: string,
    id: string,
    dto: UpdateUserDto,
  ) {
    this.assertCanAccess(requesterId, requesterRole, id);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatar_url: dto.avatarUrl }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.location !== undefined && { location: dto.location }),
      },
    });
    return this.serialize(user);
  }

  private assertCanAccess(
    requesterId: string,
    requesterRole: string,
    targetId: string,
  ) {
    if (requesterId !== targetId && requesterRole !== 'admin') {
      throw new ForbiddenException('You can only access your own user profile');
    }
  }

  private serialize(user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    avatar_url: string | null;
    bio: string | null;
    location: string | null;
    role: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      location: user.location,
      role: user.role,
    };
  }
}
