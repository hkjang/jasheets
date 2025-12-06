import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [OAuthController],
  providers: [OAuthService, GoogleStrategy, GithubStrategy],
  exports: [OAuthService],
})
export class OAuthModule {}
