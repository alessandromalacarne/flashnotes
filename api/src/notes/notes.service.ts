import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAX_GROUP_NAME_LENGTH, MAX_GROUPS_PER_NOTE } from './note-limits.js';
import { extractGroups, stripGroups } from './group-parser.js';
import type { CreateNoteDto } from './dto/create-note.dto.js';
import type { UpdateNoteDto } from './dto/update-note.dto.js';

interface ParsedNote {
  content: string;
  groupNames: string[];
}

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authContext: AuthenticationContext,
  ) {}

  async create(dto: CreateNoteDto) {
    const { content, groupNames } = parseNote(dto.content);
    const { id: userId } = this.authContext.requireUser();

    const note = await this.prisma.note.create({
      data: {
        userId,
        content,
        groups: {
          connectOrCreate: groupNames.map((name) => ({
            where: { userId_name: { userId, name } },
            create: { userId, name },
          })),
        },
      },
      include: {
        groups: { where: { userId }, select: { id: true, name: true } },
      },
    });

    return note;
  }

  async list(group?: string) {
    const { id: userId } = this.authContext.requireUser();

    return this.prisma.note.findMany({
      where: {
        userId,
        ...(group ? { groups: { some: { name: group.toLowerCase() } } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        groups: { where: { userId }, select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateNoteDto) {
    const { content, groupNames } = parseNote(dto.content);
    const { id: userId } = this.authContext.requireUser();

    const { updated } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.note.updateMany({
        where: { id, userId },
        data: { content },
      });

      if (count === 0) {
        throw new NotFoundException('Note not found');
      }

      const groups = await Promise.all(
        groupNames.map((name) =>
          tx.group.upsert({
            where: { userId_name: { userId, name } },
            update: {},
            create: { userId, name },
          }),
        ),
      );

      const updated = await tx.note.update({
        where: { id },
        data: {
          groups: { set: groups.map(({ id: groupId }) => ({ id: groupId })) },
        },
        include: {
          groups: { where: { userId }, select: { id: true, name: true } },
        },
      });

      await tx.group.deleteMany({ where: { userId, notes: { none: {} } } });

      return { updated };
    });

    return updated;
  }

  async remove(id: string): Promise<void> {
    const { id: userId } = this.authContext.requireUser();

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.note.deleteMany({ where: { id, userId } });

      if (count === 0) {
        throw new NotFoundException('Note not found');
      }

      await tx.group.deleteMany({ where: { userId, notes: { none: {} } } });
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

  if (groupNames.length > MAX_GROUPS_PER_NOTE) {
    throw new BadRequestException(
      `A note can reference at most ${MAX_GROUPS_PER_NOTE} groups`,
    );
  }

  if (groupNames.some((name) => name.length > MAX_GROUP_NAME_LENGTH)) {
    throw new BadRequestException(
      `Group names can have at most ${MAX_GROUP_NAME_LENGTH} characters`,
    );
  }

  const content = stripGroups(raw);

  if (content.length === 0) {
    throw new BadRequestException('The note needs text besides the @group');
  }

  return { content, groupNames };
}
