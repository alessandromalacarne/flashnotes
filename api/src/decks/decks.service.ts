import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DecksService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const decks = await this.prisma.deck.findMany({
      include: { _count: { select: { dumps: true } } },
      orderBy: [{ dumps: { _count: 'desc' } }, { name: 'asc' }],
    });

    return decks.map(({ id, name, _count }) => ({
      id,
      name,
      count: _count.dumps,
    }));
  }

  async remove(id: string): Promise<void> {
    const deck = await this.prisma.deck.findUnique({ where: { id } });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    await this.prisma.deck.delete({ where: { id } });
  }
}
