import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.group.findMany({
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
    const group = await this.prisma.group.findUnique({ where: { id } });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.prisma.group.delete({ where: { id } });
  }
}
