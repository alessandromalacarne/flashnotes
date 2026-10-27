import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowDispatcherService } from '../workflows/workflow-dispatcher.service.js';
import { extractDecks, stripDecks } from './deck-parser.js';
import type { CreateDumpDto } from './dto/create-dump.dto.js';
import type { UpdateDumpDto } from './dto/update-dump.dto.js';

interface ParsedDump {
  content: string;
  deckNames: string[];
}

@Injectable()
export class DumpsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly dispatcher?: WorkflowDispatcherService,
  ) {}

  async create(dto: CreateDumpDto) {
    const { content, deckNames } = parseDump(dto.content);

    const dump = await this.prisma.dump.create({
      data: {
        content,
        decks: {
          connectOrCreate: deckNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: { decks: true },
    });

    if (this.dispatcher) {
      void this.dispatcher.dispatch({
        kind: 'dumpCreated',
        occurredAt: new Date().toISOString(),
        dump: {
          id: dump.id,
          content: dump.content,
          deckNames: dump.decks.map((deck) => deck.name),
        },
      });
    }

    return dump;
  }

  async list(deck?: string) {
    return this.prisma.dump.findMany({
      where: deck ? { decks: { some: { name: deck.toLowerCase() } } } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { decks: true },
    });
  }

  async update(id: string, dto: UpdateDumpDto) {
    const { content, deckNames } = parseDump(dto.content);

    const { updated, orphanedDecks } = await this.prisma.$transaction(
      async (tx) => {
        const { count } = await tx.dump.updateMany({
          where: { id },
          data: { content },
        });

        if (count === 0) {
          throw new NotFoundException('Dump not found');
        }

        const decks = await Promise.all(
          deckNames.map((name) =>
            tx.deck.upsert({ where: { name }, update: {}, create: { name } }),
          ),
        );

        const updated = await tx.dump.update({
          where: { id },
          data: {
            decks: { set: decks.map(({ id: deckId }) => ({ id: deckId })) },
          },
          include: { decks: true },
        });

        const orphaned = await tx.deck.findMany({
          where: { dumps: { none: {} } },
        });
        await tx.deck.deleteMany({ where: { dumps: { none: {} } } });

        return { updated, orphanedDecks: orphaned };
      },
    );

    this.dispatchDeckDeletions(orphanedDecks);

    return updated;
  }

  async remove(id: string): Promise<void> {
    const orphanedDecks = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.dump.deleteMany({ where: { id } });

      if (count === 0) {
        throw new NotFoundException('Dump not found');
      }

      const orphaned = await tx.deck.findMany({
        where: { dumps: { none: {} } },
      });
      await tx.deck.deleteMany({ where: { dumps: { none: {} } } });

      return orphaned;
    });

    this.dispatchDeckDeletions(orphanedDecks);
  }

  // A deck that loses its last dump is gone exactly like a deleted one, so the
  // workflows watching it hear about it the same way.
  private dispatchDeckDeletions(decks: { id: string; name: string }[]): void {
    if (!this.dispatcher) return;
    for (const deck of decks) {
      void this.dispatcher.dispatch({
        kind: 'deckDeleted',
        occurredAt: new Date().toISOString(),
        deck: { id: deck.id, name: deck.name },
      });
    }
  }
}

// The marker only points at a deck: what lands in the body is plain text, and
// the relation is the only place a dump's decks live.
function parseDump(raw: string): ParsedDump {
  const deckNames = extractDecks(raw);

  if (deckNames.length === 0) {
    throw new BadRequestException('Include at least one @deck in the dump');
  }

  const content = stripDecks(raw);

  if (content.length === 0) {
    throw new BadRequestException('The dump needs text besides the @deck');
  }

  return { content, deckNames };
}
