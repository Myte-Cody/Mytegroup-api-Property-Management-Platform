import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AppGuard } from '../src/common/guards/app.guard';

export async function createTestApp(): Promise<INestApplication> {
  // Set environment variables for testing
  process.env.EMAIL_ENABLED = 'false';
  process.env.JWT_SECRET = 'test-secret';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // You can add mocks for services here if needed
    // .overrideProvider(EmailService)
    // .useValue(mockEmailService)
    .compile();

  const app = moduleFixture.createNestApplication();

  // Apply the same global pipes and guards as in the main app
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new AppGuard(reflector));

  await app.init();

  return app;
}
