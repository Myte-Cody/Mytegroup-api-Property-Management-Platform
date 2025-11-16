import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Command, CommandRunner } from 'nest-commander';
import { UserRole } from '../common/enums/user-role.enum';
import { UserType } from '../common/enums/user-type.enum';
import { AppModel } from '../common/interfaces/app-model.interface';
import { User, UserDocument } from '../features/users/schemas/user.schema';

@Injectable()
@Command({
  name: 'users:backfill-roles',
  description:
    'Backfill missing user.role values based on user_type and isPrimary. Safe to run multiple times.',
})
export class BackfillUserRolesCommand extends CommandRunner {
  private readonly logger = new Logger(BackfillUserRolesCommand.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: AppModel<UserDocument>,
  ) {
    super();
  }

  async run(): Promise<void> {
    this.logger.warn('Starting user role backfill...');

    const filter = {
      $or: [{ role: { $exists: false } }, { role: null }],
    };

    const users = await this.userModel.find(filter).exec();
    if (!users.length) {
      this.logger.warn('No users found with missing role. Nothing to backfill.');
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      const resolvedRole = this.resolveRole(user.user_type as UserType, !!user.isPrimary);

      if (!resolvedRole) {
        this.logger.warn(`Skipping user ${user._id} with unexpected user_type=${user.user_type}`);
        skipped += 1;
        continue;
      }

      // Only update if role is actually missing or different, so the command is idempotent
      if (user.role !== resolvedRole) {
        user.role = resolvedRole;
        await user.save();
        updated += 1;
        this.logger.log(`Updated user ${user._id} (${user.email}) to role=${resolvedRole}`);
      }
    }

    this.logger.warn(
      `User role backfill completed. Updated=${updated}, Skipped=${skipped}, Total inspected=${users.length}`,
    );
  }

  private resolveRole(userType: UserType, isPrimary: boolean): UserRole | undefined {
    switch (userType) {
      case UserType.LANDLORD:
        return isPrimary ? UserRole.LANDLORD_ADMIN : UserRole.LANDLORD_STAFF;
      case UserType.TENANT:
        return UserRole.TENANT;
      case UserType.CONTRACTOR:
        return UserRole.CONTRACTOR;
      case UserType.ADMIN:
        return UserRole.SUPER_ADMIN;
      default:
        return undefined;
    }
  }
}
