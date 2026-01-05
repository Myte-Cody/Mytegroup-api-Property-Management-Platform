import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserType } from '../../../common/enums/user-type.enum';
import { AppModule } from '../../../app.module';
import { User } from '../../users/schemas/user.schema';
import { NotificationPreferencesService } from '../notification-preferences.service';

/**
 * Script to initialize notification preferences for all existing users
 * Run this script once after deploying the notification preferences feature
 *
 * Usage:
 * npm run script:init-preferences
 * or
 * ts-node src/features/notifications/scripts/initialize-user-preferences.ts
 */
async function bootstrap() {
  console.log('Starting notification preferences initialization...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const preferencesService = app.get(NotificationPreferencesService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    // Get all users
    const users = await userModel.find().exec();
    console.log(`Found ${users.length} users to process`);

    let successCount = 0;
    let errorCount = 0;

    // Initialize preferences for each user
    for (const user of users) {
      try {
        console.log(
          `Initializing preferences for user ${user._id} (${user.email}) - ${user.user_type}`,
        );
        await preferencesService.initializeDefaults(user._id.toString(), user.user_type as UserType);
        successCount++;
      } catch (error) {
        console.error(`Failed to initialize preferences for user ${user._id}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Initialization Complete ===');
    console.log(`Total users: ${users.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
  } catch (error) {
    console.error('Fatal error during initialization:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
