import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppGuard } from './common/guards/app.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new AppGuard(reflector));

  // Set up Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Mytegroup Property Management API')
    .setDescription('API documentation for the Mytegroup Property Management Platform')
    .setVersion('1.0')
    .setExternalDoc('Download Swagger JSON', '/api-json')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // CORS setup based on environment
  const configService = app.get(ConfigService);
  const corsCsv = configService.get<string>('app.corsOrigins') || '';
  const origins = corsCsv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  // Start the server
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api`);
}
bootstrap();
