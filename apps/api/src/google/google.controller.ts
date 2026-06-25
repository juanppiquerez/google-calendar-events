import { Controller, Delete, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  THROTTLE_STRICT_LIMIT,
  THROTTLE_STRICT_TTL_MS,
} from '../common/constants/throttle.constants';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly usersService: UsersService,
  ) {}

  @Get('connect')
  @Throttle({
    default: { limit: THROTTLE_STRICT_LIMIT, ttl: THROTTLE_STRICT_TTL_MS },
  })
  @UseGuards(JwtAuthGuard)
  async connect(@CurrentUser() authUser: AuthUser) {
    const user = await this.resolveUser(authUser);
    const url = this.googleService.getAuthorizationUrl(user.id);
    return { url };
  }

  @Get('callback')
  @Throttle({
    default: { limit: THROTTLE_STRICT_LIMIT, ttl: THROTTLE_STRICT_TTL_MS },
  })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';

    if (error) {
      return res.redirect(`${base}/dashboard?google=error`);
    }

    if (!code || !state) {
      return res.redirect(`${base}/dashboard?google=error`);
    }

    try {
      const redirectUrl = await this.googleService.handleOAuthCallback(
        code,
        state,
      );
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect(`${base}/dashboard?google=error`);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser() authUser: AuthUser) {
    const user = await this.resolveUser(authUser);
    return this.googleService.getConnectionStatus(user.id);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() authUser: AuthUser) {
    const user = await this.resolveUser(authUser);
    await this.googleService.disconnect(user.id);
    return { message: 'Google Calendar disconnected' };
  }

  private async resolveUser(authUser: AuthUser) {
    return this.usersService.findOrCreateByAuth0Id({
      auth0Id: authUser.sub,
      email: authUser.email ?? `${authUser.sub}@users.auth0`,
      name: authUser.name ?? authUser.email ?? 'User',
    });
  }
}
