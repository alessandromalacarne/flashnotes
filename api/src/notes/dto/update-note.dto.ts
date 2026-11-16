import { MAX_NOTE_LENGTH } from '@flashnotes/core';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NOTE_LENGTH)
  content!: string;
}
