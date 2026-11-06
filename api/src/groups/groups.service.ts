import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authContext: AuthenticationContext,
  ) {}

  async list() {
    const { id: userId } = this.authContext.requireUser();

    const groups = await this.prisma.group.findMany({
      where: { userId },
      include: { _count: { select: { notes: true } } },
      orderBy: [{ notes: { _count: 'desc' } }, { name: 'asc' }],
    });

    return groups.map(({ id, name, _count }) => ({
      id,
      name,
      count: _count.notes,
    }));
  }

  async remove(id: string): Promise<void> {
    const { id: userId } = this.authContext.requireUser();

    const { count } = await this.prisma.group.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new NotFoundException('Group not found');
    }
  }
}
