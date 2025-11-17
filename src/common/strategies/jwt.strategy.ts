import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
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
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (!req || !req.cookies) return null;
          return req.cookies['access_token'] || null;
        },
      ]),
      secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-key',
      ignoreExpiration: false,
    });
  }
  async validate(payload: any) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('_id username email user_type organization_id role isPrimary')
      .exec();

    if (!user || (user as any).deleted || user.isDisabled) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
