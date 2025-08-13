import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set up Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Mytegroup Property Management API")
    .setDescription(
      "API documentation for the Mytegroup Property Management Platform",
    )
    .setVersion("1.0")
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management endpoints")
    .addTag("properties", "Property management endpoints")
    .addTag("organizations", "Organization management endpoints")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // Start the server
  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api`,
  );
}
bootstrap();
