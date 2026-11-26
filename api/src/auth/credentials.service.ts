import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { User } from '@flashnotes/core';
import { UsersRepository } from '../users/users.repository.js';
import { LoginBackoffService } from './login-backoff.service.js';
import { TooManyAttemptsException } from './too-many-attempts.filter.js';

// The demo is advertised publicly, so naming it here leaks nothing. It is the
// hint for anyone who types the address into the password form.
export const DEMO_SIGN_IN_MESSAGE =
  'The demo account is available from the Try demo button';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly backoff: LoginBackoffService,
  ) {}

  async register(email: string, password: string): Promise<User> {
    if (await this.usersRepository.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.passwordHasher.hash(password);
    return this.usersRepository.create(email, passwordHash);
  }

  async verify(email: string, password: string): Promise<User | null> {
    const retryAfterSeconds = this.backoff.retryAfterSeconds(email);
    if (retryAfterSeconds > 0) {
      throw new TooManyAttemptsException(retryAfterSeconds);
    }

    const found = await this.usersRepository.findCredentials(email);

    // Refuse the demo before verifying its (never disclosed) hash, so demo
    // attempts neither consume a password check nor count towards the lockout.
    if (found?.user.isDemo) {
      throw new UnauthorizedException(DEMO_SIGN_IN_MESSAGE);
    }

    const valid = await this.passwordHasher.verify(
      password,
      found?.passwordHash,
    );
    if (!found || !valid) {
      this.backoff.registerFailure(email);
      return null;
    }

    this.backoff.registerSuccess(email);

    if (this.passwordHasher.needsRehash(found.passwordHash)) {
      await this.usersRepository.updatePasswordHash(
        found.user.id,
        await this.passwordHasher.hash(password),
      );
    }

    return found.user;
  }

  findDemoUser(): Promise<User | null> {
    return this.usersRepository.findDemo();
  }
}
