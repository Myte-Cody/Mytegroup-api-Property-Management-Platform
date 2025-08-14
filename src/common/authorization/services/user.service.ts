import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../../features/users/schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  /**
   * Get the organization ID for a user
   * @param userId The user ID
   * @returns The organization ID or null if not found
   */
  async getUserOrganizationId(userId: string | Types.ObjectId): Promise<Types.ObjectId | null> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await this.userModel.findById(userId).exec();
    return user?.organization || null;
  }
}
