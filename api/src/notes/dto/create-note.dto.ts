import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_NOTE_LENGTH } from '../note-limits.js';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NOTE_LENGTH)
  content!: string;
}
