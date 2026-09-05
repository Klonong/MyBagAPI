import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { JwtPayload } from './types/authenticated-request';

const SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  avatarUrl?: string | null;
  location?: string | null;
  bio?: string | null;
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
    sessionMeta: SessionMeta,
  ): Promise<{ user: PublicUser; token: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, phone: dto.phone },
    });

    const token = await this.signToken(user, sessionMeta);
    return { user: this.toPublicUser(user), token };
  }

  async login(
    dto: LoginDto,
    sessionMeta: SessionMeta,
  ): Promise<{ user: PublicUser; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user ||
      !user.is_active ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.signToken(user, sessionMeta);
    return { user: this.toPublicUser(user), token };
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async revokeSessionFromToken(token: string): Promise<void> {
    const payload = await this.jwtService
      .verifyAsync<JwtPayload>(token)
      .catch(() => null);
    if (!payload) {
      return;
    }
    await this.prisma.sessions.updateMany({
      where: { id: payload.sessionId, user_id: payload.sub },
      data: { revoked_at: new Date() },
    });
  }

  private async signToken(
    user: User,
    sessionMeta: SessionMeta,
  ): Promise<string> {
    const session = await this.prisma.sessions.create({
      data: {
        user_id: user.id,
        ip: sessionMeta.ip,
        user_agent: sessionMeta.userAgent,
      },
    });
    return this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      sessionId: session.id,
    });
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatar_url,
      location: user.location,
      bio: user.bio,
    };
  }
}
