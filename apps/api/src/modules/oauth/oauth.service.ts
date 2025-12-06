import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleOAuthLogin(profile: OAuthProfile) {
    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          password: '', // OAuth users don't have password
          name: profile.name,
          avatar: profile.avatar,
        },
      });
      
      this.logger.log(`New OAuth user created: ${profile.email} via ${profile.provider}`);
    } else {
      // Update profile info if needed
      if (profile.avatar && !user.avatar) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { 
            avatar: profile.avatar,
            name: user.name || profile.name,
          },
        });
      }
    }

    // Generate tokens
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  getGoogleAuthUrl(): string {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI', 'http://localhost:4000/api/oauth/google/callback');
    
    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  getGithubAuthUrl(): string {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const redirectUri = this.configService.get<string>('GITHUB_REDIRECT_URI', 'http://localhost:4000/api/oauth/github/callback');
    
    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      scope: 'user:email',
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeGoogleCode(code: string): Promise<OAuthProfile> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri || '',
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      throw new Error('Failed to exchange Google code');
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userResponse.json();

    return {
      provider: 'google',
      providerId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    };
  }

  async exchangeGithubCode(code: string): Promise<OAuthProfile> {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      throw new Error('Failed to exchange Github code');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userResponse.json();

    // Get email if not public
    let email = userInfo.email;
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const emails = await emailResponse.json();
      const primaryEmail = emails.find((e: any) => e.primary);
      email = primaryEmail?.email;
    }

    return {
      provider: 'github',
      providerId: String(userInfo.id),
      email,
      name: userInfo.name || userInfo.login,
      avatar: userInfo.avatar_url,
    };
  }

  private generateRefreshToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}
