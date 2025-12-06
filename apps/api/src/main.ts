import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:4000','http://localhost:3001', 'http://127.0.0.1:3001'];

  app.enableCors({
    origin: corsOrigins,
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

bootstrap();
