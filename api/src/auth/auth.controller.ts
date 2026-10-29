import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Authenticate,
  CurrentUser,
  Public,
  SignInService,
} from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { SignInDto, SignUpDto } from './auth.dto.js';
import { CredentialsService } from './credentials.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
  ) {}

  @Public()
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
