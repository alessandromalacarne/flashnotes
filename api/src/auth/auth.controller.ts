import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Authenticate,
  CurrentUser,
  Public,
  SignInService,
} from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@flashnotes/core';
import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  DEMO_THROTTLE_LIMIT,
  DEMO_THROTTLE_TTL_MS,
} from '../security/throttle.config.js';
import { SignInDto, SignUpDto } from './auth.dto.js';
import { CredentialsService } from './credentials.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
  ) {}

  @Public()
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @Post('sign-up')
  async signUp(@Body() body: SignUpDto): Promise<User> {
    const user = await this.credentialsService.register(
      body.email,
      body.password,
    );
    await this.signInService.signIn(user.id, { method: 'password' });
    return user;
  }

  @Public()
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: SignInDto) {
    const user = await this.credentialsService.verify(
      body.email,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { session } = await this.signInService.signIn(user.id, {
      method: 'password',
    });
    return { user, mfaRequired: session.mfa === 'pending' };
  }

  @Public()
  @Throttle({
    demo: { limit: DEMO_THROTTLE_LIMIT, ttl: DEMO_THROTTLE_TTL_MS },
  })
  @Post('demo')
  @HttpCode(200)
  async demo() {
    const user = await this.credentialsService.findDemoUser();
    if (!user) {
      throw new ServiceUnavailableException('Demo is not available');
    }

    await this.signInService.signIn(user.id, { method: 'password' });
    return { user };
  }

  @Authenticate({ optional: true })
  @Get('me')
  me(@CurrentUser() user: User | null) {
    return { user };
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }
}
