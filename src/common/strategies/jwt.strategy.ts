import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../features/users/schemas/user.schema';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
      .select('id organization')
      .populate('organization', '_id name type')
      .exec();
    return user;
  }
}
