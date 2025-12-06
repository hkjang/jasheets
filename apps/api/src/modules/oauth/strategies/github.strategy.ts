import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'MISSING_GITHUB_CLIENT_ID',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'MISSING_GITHUB_CLIENT_SECRET',
      callbackURL: configService.get<string>('GITHUB_REDIRECT_URI') || 'http://localhost:4000/api/oauth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any) => void,
  ): Promise<any> {
    const { id, username, displayName, emails, photos } = profile;
    const user = {
      provider: 'github',
      providerId: id,
      email: emails?.[0]?.value,
      name: displayName || username,
      avatar: photos?.[0]?.value,
      accessToken,
    };
    done(null, user);
  }
}
