import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowDispatcherService } from '../workflows/workflow-dispatcher.service.js';

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly dispatcher?: WorkflowDispatcherService,
  ) {}

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

    if (this.dispatcher) {
      void this.dispatcher.dispatch({
        kind: 'deckDeleted',
        occurredAt: new Date().toISOString(),
        deck: { id: deck.id, name: deck.name },
      });
    }
  }
}
