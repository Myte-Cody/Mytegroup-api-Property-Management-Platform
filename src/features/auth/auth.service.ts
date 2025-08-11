import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { User } from "../users/schemas/user.schema";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password, role, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException(
        "User with this email or username already exists"
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new this.userModel({
      username,
      email,
      password: passwordHash,
      role: role || "Tenant",
      phone,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedUser = await newUser.save();

    // Generate JWT token
    const payload = {
      sub: savedUser._id,
      email: savedUser.email,
      role: savedUser.role,
    };

    return {
      user: {
        _id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        role: savedUser.role,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userModel
      .findOne({ email })
      .select("+password")
      .exec();

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Generate JWT token
    const payload = { sub: user._id, email: user.email, role: user.role };

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }
}
