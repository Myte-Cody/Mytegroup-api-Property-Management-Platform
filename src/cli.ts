import { CommandFactory } from 'nest-commander';
import { CommandsModule } from './commands/commands.module';
import { AppModule } from './app.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [AppModule, CommandsModule],
})
class CliAppModule {}

async function bootstrap() {
  await CommandFactory.run(CliAppModule, ['warn', 'error']);
}

bootstrap();