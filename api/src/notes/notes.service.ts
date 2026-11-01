import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { extractGroups, stripGroups } from './group-parser.js';
import type { CreateNoteDto } from './dto/create-note.dto.js';
import type { UpdateNoteDto } from './dto/update-note.dto.js';

interface ParsedNote {
  content: string;
  groupNames: string[];
}

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNoteDto) {
    const { content, groupNames } = parseNote(dto.content);

    const note = await this.prisma.note.create({
      data: {
        content,
        groups: {
          connectOrCreate: groupNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: { groups: true },
    });

    return note;
  }

  async list(group?: string) {
    return this.prisma.note.findMany({
      where: group ? { groups: { some: { name: group.toLowerCase() } } } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { groups: true },
    });
  }

  async update(id: string, dto: UpdateNoteDto) {
    const { content, groupNames } = parseNote(dto.content);

    const { updated } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.note.updateMany({
        where: { id },
        data: { content },
      });

      if (count === 0) {
        throw new NotFoundException('Note not found');
      }

      const groups = await Promise.all(
        groupNames.map((name) =>
          tx.group.upsert({ where: { name }, update: {}, create: { name } }),
        ),
      );

      const updated = await tx.note.update({
        where: { id },
        data: {
          groups: { set: groups.map(({ id: groupId }) => ({ id: groupId })) },
        },
        include: { groups: true },
      });

      await tx.group.deleteMany({ where: { notes: { none: {} } } });

      return { updated };
    });

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.note.deleteMany({ where: { id } });

      if (count === 0) {
        throw new NotFoundException('Note not found');
      }

      await tx.group.deleteMany({ where: { notes: { none: {} } } });
    });
  }
}

// The marker only points at a group: what lands in the body is plain text, and
// the relation is the only place a note's groups live.
function parseNote(raw: string): ParsedNote {
  const groupNames = extractGroups(raw);

  if (groupNames.length === 0) {
    throw new BadRequestException('Include at least one @group in the note');
  }

  const content = stripGroups(raw);

  if (content.length === 0) {
    throw new BadRequestException('The note needs text besides the @group');
  }

  return { content, groupNames };
}
