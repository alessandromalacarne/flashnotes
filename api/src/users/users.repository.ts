import type { User } from '@flashnotes/core';
import { Injectable } from '@nestjs/common';
import { normalizeEmail } from './email.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, passwordHash: string): Promise<User> {
    return this.prisma.user.create({
      data: { email: normalizeEmail(email), passwordHash },
      select: { id: true, email: true, isDemo: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isDemo: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true, isDemo: true },
    });
  }

  async findDemo(): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { isDemo: true },
      select: { id: true, email: true, isDemo: true },
    });
  }

  async findCredentials(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true, isDemo: true, passwordHash: true },
    });

    if (!user) {
      return null;
    }

    return {
      user: { id: user.id, email: user.email, isDemo: user.isDemo },
      passwordHash: user.passwordHash,
    };
  }

  async updatePasswordHash(id: string, hash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
  }
}
