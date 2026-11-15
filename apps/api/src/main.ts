import { config as loadDotenv } from 'dotenv';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

loadDotenv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = configureApp(app);
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  await app.listen(config.port);
}

void bootstrap();
