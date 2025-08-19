import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel
      .findOne({ email })
      .select('+password')
      .populate('organization', '_id name type')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user._id, email: user.email };

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        organization: user.organization,
        isAdmin: user.isAdmin,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('_id username email isAdmin')
      .populate('organization', '_id name type')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      organization: user.organization,
      isAdmin: user.isAdmin,
    };
  }
}
