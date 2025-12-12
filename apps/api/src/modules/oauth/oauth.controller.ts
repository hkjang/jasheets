import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { OAuthService } from './oauth.service';
import { ConfigService } from '@nestjs/config';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  // Google OAuth
  @Get('google')
  googleAuth(@Res() res: Response) {
    const url = this.oauthService.getGoogleAuthUrl();
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const profile = await this.oauthService.exchangeGoogleCode(code);
      const result = await this.oauthService.handleOAuthLogin(profile);
      
      // Redirect to frontend with tokens
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      
      return res.redirect(`${frontendUrl}/auth/callback?${params}`);
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/auth/error?error=google_auth_failed`);
    }
  }

  // Github OAuth
  @Get('github')
  githubAuth(@Res() res: Response) {
    const url = this.oauthService.getGithubAuthUrl();
    return res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const profile = await this.oauthService.exchangeGithubCode(code);
      const result = await this.oauthService.handleOAuthLogin(profile);
      
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      
      return res.redirect(`${frontendUrl}/auth/callback?${params}`);
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/auth/error?error=github_auth_failed`);
    }
  }
}

