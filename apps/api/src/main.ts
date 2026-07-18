import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { NextFunction, Request, Response } from 'express';
import { getCorsOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  // Enable CORS
  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.API_PORT || 4000;
  await app.listen(port);

  console.log(`🚀 JaSheets API running on http://localhost:${port}`);
}

void bootstrap();
