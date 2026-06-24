import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const frontendOrigin = process.env.APP_BASE_URL;
  if (!frontendOrigin) {
    throw new Error('APP_BASE_URL environment variable is required');
  }

  app.enableCors({
    origin: frontendOrigin,
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
