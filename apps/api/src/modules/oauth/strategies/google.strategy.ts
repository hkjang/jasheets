import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'MISSING_GOOGLE_CLIENT_ID',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'MISSING_GOOGLE_CLIENT_SECRET',
      callbackURL: configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:4000/api/oauth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      provider: 'google',
      providerId: profile.id,
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`,
      avatar: photos[0]?.value,
      accessToken,
    };
    done(null, user);
  }
}
