import { ConflictException, Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';
import { LoginBackoffService } from './login-backoff.service.js';
import { TooManyAttemptsException } from './too-many-attempts.filter.js';

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
}
