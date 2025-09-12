import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { AppModel } from '../../common/interfaces/app-model.interface';

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
      .populate('party_id') // Populate the party reference (Landlord/Tenant/Contractor)
      .populate('landlord_id', 'company_name') // Populate landlord info
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Ensure user has required tenant context
    if (!user.landlord_id) {
      throw new UnauthorizedException('User account is not properly configured - missing tenant context');
    }

    const payload = { 
      sub: user._id, 
      email: user.email,
      user_type: user.user_type,
      landlord_id: user.landlord_id,
      party_id: user.party_id
    };

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        landlord_id: user.landlord_id,
        party_info: user.party_id,
        landlord_info: user.landlord_id,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('_id username email user_type landlord_id party_id')
      .populate('party_id')
      .populate('landlord_id', 'company_name')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Ensure user has tenant context
    if (!user.landlord_id) {
      throw new UnauthorizedException('User account is missing tenant context');
    }

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      landlord_id: user.landlord_id,
      party_id: user.party_id,
      party_info: user.party_id, // Populated party data
      landlord_info: user.landlord_id, // Populated landlord data
    };
  }
}
