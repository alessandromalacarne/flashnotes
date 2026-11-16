import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@flashnotes/core';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

export class SignUpDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}

export class SignInDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email: string;

  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}
