import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';
import { CommandsModule } from './commands/commands.module';

@Module({
  imports: [AppModule, CommandsModule],
})
class CliAppModule {}

async function bootstrap() {
  await CommandFactory.run(CliAppModule, ['warn', 'error']);
}

bootstrap();
