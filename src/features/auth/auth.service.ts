import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: AppModel<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel
      .findOne({ email })
      .select('+password')
      // todo populate party ?
      .populate('party_id')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user._id,
      email: user.email,
      user_type: user.user_type,
      party_id: user.party_id,
    };

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        party_info: user.party_id,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('_id username email user_type party_id')
      .populate('party_id')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      party_id: user.party_id,
      party_info: user.party_id, // Populated party data
    };
  }
}
