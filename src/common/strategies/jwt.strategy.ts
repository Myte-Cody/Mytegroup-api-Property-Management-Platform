import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '../../features/users/schemas/user.schema';
import { AppModel } from '../interfaces/app-model.interface';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: AppModel<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-key',
      ignoreExpiration: false,
    });
  }
  async validate(payload: any) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('_id username email user_type landlord_id party_id')
      .populate('party_id') // Populate the party reference
      .populate('landlord_id', 'company_name') // Populate landlord info
      .exec();

    // Ensure user exists and has tenant context
    if (!user) {
      return null;
    }

    if (!user.landlord_id) {
      return null; // Reject users without tenant context
    }

    return user;
  }
}
