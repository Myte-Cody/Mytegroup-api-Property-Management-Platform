import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import * as nodeCrypto from 'crypto';
import { Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { CreateContractorDto } from '../contractors/dto/create-contractor.dto';
import { Contractor } from '../contractors/schema/contractor.schema';
import { AuthEmailService } from '../email/services/auth-email.service';
import { Landlord } from '../landlords/schema/landlord.schema';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';
import { Tenant } from '../tenants/schema/tenant.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordReset } from './schemas/password-reset.schema';
import { Session } from './schemas/session.schema';
import { VerificationToken } from './schemas/verification-token.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: AppModel<UserDocument>,
    @InjectModel(Landlord.name) private readonly landlordModel: AppModel<Landlord>,
    @InjectModel(Tenant.name) private readonly tenantModel: AppModel<Tenant>,
    @InjectModel(Contractor.name) private readonly contractorModel: AppModel<Contractor>,
    @InjectModel(Session.name) private readonly sessionModel: AppModel<Session>,
    @InjectModel(PasswordReset.name)
    private readonly passwordResetModel: AppModel<PasswordReset>,
    @InjectModel(VerificationToken.name)
    private readonly verificationModel: AppModel<VerificationToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authEmailService: AuthEmailService,
  ) {}

  private readonly maxFailedLoginAttempts = 5;
  private readonly lockoutBaseMinutes = 5;

  private async purgeUnverifiedUser(existing: UserDocument) {
    try {
      await this.sessionModel.deleteMany({ userId: existing._id });
      await this.passwordResetModel.deleteMany({ userId: existing._id });
      await this.verificationModel.deleteMany({ userId: existing._id });
    } catch {}

    try {
      if (existing.user_type === UserType.LANDLORD && existing.organization_id) {
        await this.landlordModel.deleteOne({ _id: existing.organization_id });
      }
      if (existing.user_type === UserType.TENANT && existing.organization_id) {
        await this.tenantModel.deleteOne({ _id: existing.organization_id });
      }
      if (existing.user_type === UserType.CONTRACTOR && existing.organization_id) {
        await this.contractorModel.deleteOne({ _id: existing.organization_id });
      }
    } catch {}

    try {
      await this.userModel.deleteOne({ _id: existing._id });
    } catch {}
  }

  private getCookieDomain() {
    return this.configService.get<string>('auth.cookieDomain') || undefined;
  }

  private getAccessTokenTTL() {
    // JwtModule uses config auth.jwtExpiration
    return this.configService.get<string>('auth.jwtExpiration') || '15m';
  }

  private parseExpirationToMs(expiration: string): number {
    // Parse expiration strings like '15m', '1h', '7d' to milliseconds
    const match = expiration.match(/^(\d+)([smhd])$/i);
    let ms = 15 * 60 * 1000; // 15m default
    if (match) {
      const val = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const map: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 3600 * 1000,
        d: 24 * 3600 * 1000,
      };
      ms = val * (map[unit] || map['d']);
    }
    return ms;
  }

  private getRefreshExpiryDate(): Date {
    const raw = this.configService.get<string>('auth.refreshTtl') || '30d';
    const ms = this.parseExpirationToMs(raw);
    return new Date(Date.now() + ms);
  }

  private async verifyPassword(plain: string, hashed: string): Promise<boolean> {
    // Try argon2 first, then bcrypt for legacy hashes
    try {
      if (hashed.startsWith('$argon2')) {
        return await argon2.verify(hashed, plain);
      }
    } catch {}
    try {
      return await bcrypt.compare(plain, hashed);
    } catch {
      return false;
    }
  }

  private async hashPassword(plain: string): Promise<string> {
    return await argon2.hash(plain, { type: argon2.argon2id });
  }

  private signAccessToken(user: UserDocument): string {
    const payload = {
      sub: user._id,
      email: user.email,
      user_type: user.user_type,
      organization_id: user.organization_id,
      role: this.resolveUserRole(user),
    };
    return this.jwtService.sign(payload);
  }

  private async createSession(
    userId: Types.ObjectId,
    refreshToken: string,
    ip?: string,
    userAgent?: string,
  ) {
    const refreshTokenHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    const doc = new this.sessionModel({
      userId,
      refreshTokenHash,
      ip,
      userAgent,
      expiresAt: this.getRefreshExpiryDate(),
    });
    await doc.save();
    return doc;
  }

  private setAuthCookies(res: any, accessToken: string, refreshToken: string) {
    const isProd = (this.configService.get<string>('NODE_ENV') || 'development') === 'production';
    const domain = this.getCookieDomain();

    // Get the JWT expiration from config and convert to milliseconds
    const accessTokenTtl = this.getAccessTokenTTL();
    const accessTokenMaxAge = this.parseExpirationToMs(accessTokenTtl);

    // access_token: HttpOnly, Strict, matches JWT expiration
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      domain,
      path: '/',
      maxAge: accessTokenMaxAge,
    });

    // refresh_token: HttpOnly, Lax, long-lived
    const refreshTokenTtl = this.configService.get<string>('auth.refreshTtl') || '30d';
    const refreshTokenMaxAge = this.parseExpirationToMs(refreshTokenTtl);
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: refreshTokenMaxAge,
    });

    this.setCsrfCookie(res);
  }

  private clearAuthCookies(res: any) {
    const isProd = (this.configService.get<string>('NODE_ENV') || 'development') === 'production';
    const domain = this.getCookieDomain();
    const base = { httpOnly: true, secure: isProd, domain, path: '/' } as any;
    res.cookie('access_token', '', { ...base, maxAge: 0 });
    res.cookie('refresh_token', '', { ...base, maxAge: 0 });
    res.cookie('user-data', '', { ...base, httpOnly: false, maxAge: 0 });
    res.cookie('csrf_token', '', {
      secure: isProd,
      sameSite: 'strict',
      domain,
      path: '/',
      maxAge: 0,
    });
  }

  private newRefreshToken(): string {
    return nodeCrypto.randomBytes(48).toString('hex');
  }

  private async generateUniqueLandlordName(desiredName: string): Promise<string> {
    const baseName = desiredName?.trim() || 'Landlord';
    let uniqueName = baseName;
    let counter = 2;

    while (await this.landlordModel.exists({ name: uniqueName })) {
      uniqueName = `${baseName} (${counter})`;
      counter += 1;
    }

    return uniqueName;
  }

  private resolveUserRole(user: UserDocument): UserRole | undefined {
    if (user.role) {
      return user.role as UserRole;
    }

    switch (user.user_type) {
      case UserType.LANDLORD:
        return user.isPrimary ? UserRole.LANDLORD_ADMIN : UserRole.LANDLORD_STAFF;
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

  private setCsrfCookie(res: any) {
    if (!res?.cookie) {
      return;
    }
    const isProd = (this.configService.get<string>('NODE_ENV') || 'development') === 'production';
    const domain = this.getCookieDomain();
    const token = nodeCrypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', token, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      domain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private setUserDataCookie(res: any, user: UserDocument) {
    if (!res?.cookie) {
      return;
    }
    const isProd = (this.configService.get<string>('NODE_ENV') || 'development') === 'production';
    const domain = this.getCookieDomain();
    const resolvedRole = this.resolveUserRole(user);

    res.cookie(
      'user-data',
      JSON.stringify({
        _id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        organization_id: user.organization_id,
        isPrimary: user.isPrimary,
        emailVerifiedAt: user.emailVerifiedAt || null,
        role: resolvedRole,
      }),
      {
        httpOnly: false,
        secure: isProd,
        sameSite: 'lax',
        domain,
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    );
  }

  async issueAuthCookiesForUser(user: UserDocument, res: any, ip?: string, userAgent?: string) {
    const accessToken = this.signAccessToken(user as any);
    const refreshToken = this.newRefreshToken();
    await this.createSession(user._id as any, refreshToken, ip, userAgent);
    this.setAuthCookies(res, accessToken, refreshToken);
    this.setUserDataCookie(res, user);

    const resolvedRole = this.resolveUserRole(user as any);

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        organization_id: user.organization_id,
        isPrimary: user.isPrimary,
        emailVerifiedAt: user.emailVerifiedAt || null,
        role: resolvedRole,
      },
      accessToken,
    };
  }

  private calculateLockoutDuration(attempts: number): number {
    if (attempts < this.maxFailedLoginAttempts) {
      return 0;
    }
    const overage = Math.max(0, attempts - this.maxFailedLoginAttempts);
    const multiplier = Math.min(6, Math.floor(overage / 2) + 1);
    return this.lockoutBaseMinutes * multiplier * 60 * 1000;
  }

  async login(loginDto: LoginDto, res?: any, ip?: string, userAgent?: string) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email }).select('+password').exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if ((user as any).deleted || user.isDisabled) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (user.lockoutExpiresAt && user.lockoutExpiresAt > new Date()) {
      const diffMs = user.lockoutExpiresAt.getTime() - Date.now();
      const minutes = Math.max(1, Math.ceil(diffMs / 60000));
      throw new UnauthorizedException(
        `Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      );
    }

    const isPasswordValid = await this.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockoutDuration = this.calculateLockoutDuration(user.failedLoginAttempts);
      if (lockoutDuration > 0) {
        user.lockoutExpiresAt = new Date(Date.now() + lockoutDuration);
      }
      await user.save();
      if (lockoutDuration > 0) {
        throw new UnauthorizedException('Too many failed attempts. Account temporarily locked.');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts || user.lockoutExpiresAt) {
      user.failedLoginAttempts = 0;
      user.lockoutExpiresAt = undefined;
      await user.save();
    }

    const accessToken = this.signAccessToken(user);
    const resolvedRole = this.resolveUserRole(user);

    const refreshToken = this.newRefreshToken();
    await this.createSession(user._id as any, refreshToken, ip, userAgent);
    if (res) {
      this.setAuthCookies(res, accessToken, refreshToken);
      this.setUserDataCookie(res, user);
    }

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        organization_id: user.organization_id,
        isPrimary: user.isPrimary,
        emailVerifiedAt: user.emailVerifiedAt || null,
        role: resolvedRole,
      },
      accessToken,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('_id username email user_type organization_id role isPrimary emailVerifiedAt')
      .populate('organization_id')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      organization_id: user.organization_id,
      organization_info: user.organization_id,
      role: this.resolveUserRole(user),
      emailVerifiedAt: user.emailVerifiedAt || null,
      isPrimary: user.isPrimary,
    };
  }

  async registerLandlord(dto: RegisterDto, res?: any, ip?: string, userAgent?: string) {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.userModel.findOne({ email: normalizedEmail }).exec();
    if (existing) {
      if (existing.emailVerifiedAt) {
        throw new BadRequestException('Email is already registered');
      }
      await this.purgeUnverifiedUser(existing);
    }

    const requestedOrgName =
      dto.organizationName?.trim() || `${dto.firstName} ${dto.lastName}`.trim() || 'Landlord';
    const landlordName = await this.generateUniqueLandlordName(requestedOrgName);
    const landlord = new this.landlordModel({ name: landlordName });
    const savedLandlord = await landlord.save();

    const hashed = await this.hashPassword(dto.password);
    const username = (dto.email.split('@')[0] || dto.firstName || 'user').toLowerCase();
    const user = new this.userModel({
      username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: normalizedEmail,
      password: hashed,
      user_type: 'Landlord',
      organization_id: savedLandlord._id,
      isPrimary: true,
      role: UserRole.LANDLORD_ADMIN,
    });
    const savedUser = await user.save();

    // Send verification email (non-blocking)
    try {
      await this.requestEmailVerification(savedUser as any);
    } catch {}

    // Issue auth cookies so user is logged in and can resend verification email
    if (res) {
      const authResult = await this.issueAuthCookiesForUser(savedUser as any, res, ip, userAgent);
      return {
        success: true,
        message: 'Registration successful. Please verify your email.',
        organization: {
          _id: savedLandlord._id,
          name: landlordName,
        },
        user: authResult.user,
        accessToken: authResult.accessToken,
      };
    }

    return {
      success: true,
      message: 'Registration successful. Please verify your email.',
      organization: {
        _id: savedLandlord._id,
        name: landlordName,
      },
    };
  }

  async registerTenant(dto: CreateTenantDto, res?: any, ip?: string, userAgent?: string) {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.userModel.findOne({ email: normalizedEmail }).exec();
    if (existing) {
      if (existing.emailVerifiedAt) {
        throw new BadRequestException('Email is already registered');
      }
      await this.purgeUnverifiedUser(existing);
    }

    const existingUsername = await this.userModel
      .findOne({ username: dto.username.toLowerCase() })
      .exec();
    if (existingUsername) {
      throw new BadRequestException('Username is already taken');
    }

    const existingTenant = await this.tenantModel
      .findOne({ name: { $regex: new RegExp(`^${dto.name}$`, 'i') } })
      .exec();
    if (existingTenant) {
      throw new BadRequestException('A tenant with this name already exists');
    }

    const tenant = new this.tenantModel({ name: dto.name });
    const savedTenant = await tenant.save();

    const hashed = await this.hashPassword(dto.password);
    const user = new this.userModel({
      username: dto.username.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: normalizedEmail,
      phone: dto.phone,
      password: hashed,
      user_type: UserType.TENANT,
      organization_id: savedTenant._id,
      isPrimary: true,
      role: UserRole.TENANT,
    });
    const savedUser = await user.save();

    try {
      await this.requestEmailVerification(savedUser as any);
    } catch {}

    // Issue auth cookies so user is logged in and can resend verification email
    if (res) {
      const authResult = await this.issueAuthCookiesForUser(savedUser as any, res, ip, userAgent);
      return {
        success: true,
        message: 'Registration successful. Please verify your email.',
        organization: {
          _id: savedTenant._id,
          name: dto.name,
        },
        user: authResult.user,
        accessToken: authResult.accessToken,
      };
    }

    return {
      success: true,
      message: 'Registration successful. Please verify your email.',
      organization: {
        _id: savedTenant._id,
        name: dto.name,
      },
    };
  }

  async registerContractor(dto: CreateContractorDto, res?: any, ip?: string, userAgent?: string) {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.userModel.findOne({ email: normalizedEmail }).exec();
    if (existing) {
      if (existing.emailVerifiedAt) {
        throw new BadRequestException('Email is already registered');
      }
      await this.purgeUnverifiedUser(existing);
    }

    const existingUsername = await this.userModel
      .findOne({ username: dto.username.toLowerCase() })
      .exec();
    if (existingUsername) {
      throw new BadRequestException('Username is already taken');
    }

    const existingContractor = await this.contractorModel.findOne({ name: dto.name }).exec();
    if (existingContractor) {
      throw new BadRequestException('A contractor with this name already exists');
    }

    const contractor = new this.contractorModel({
      name: dto.name,
      category: dto.category,
    });
    const savedContractor = await contractor.save();

    const hashed = await this.hashPassword(dto.password);
    const user = new this.userModel({
      username: dto.username.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: normalizedEmail,
      phone: dto.phone,
      password: hashed,
      user_type: UserType.CONTRACTOR,
      organization_id: savedContractor._id,
      isPrimary: true,
      role: UserRole.CONTRACTOR,
    });
    const savedUser = await user.save();

    try {
      await this.requestEmailVerification(savedUser as any);
    } catch {}

    // Issue auth cookies so user is logged in and can resend verification email
    if (res) {
      const authResult = await this.issueAuthCookiesForUser(savedUser as any, res, ip, userAgent);
      return {
        success: true,
        message: 'Registration successful. Please verify your email.',
        organization: {
          _id: savedContractor._id,
          name: dto.name,
        },
        user: authResult.user,
        accessToken: authResult.accessToken,
      };
    }

    return {
      success: true,
      message: 'Registration successful. Please verify your email.',
      organization: {
        _id: savedContractor._id,
        name: dto.name,
      },
    };
  }

  private async createVerification(user: UserDocument): Promise<{ token: string; code: string }> {
    const tokenRaw = this.newRefreshToken();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = await argon2.hash(tokenRaw, { type: argon2.argon2id });
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const doc = new this.verificationModel({
      userId: user._id,
      tokenHash,
      codeHash,
      expiresAt: expiry,
    });
    await doc.save();
    return { token: tokenRaw, code };
  }

  async requestEmailVerification(user: UserDocument) {
    if (user.emailVerifiedAt) return { success: true };
    // Create token & code then send email
    const { token, code } = await this.createVerification(user);
    try {
      await this.authEmailService.sendEmailVerification(user.email, token, code, { queue: false });
    } catch {}
    // For dev, optionally log code
    return { success: true };
  }

  async confirmEmailVerification(
    currentUser: UserDocument | null,
    token?: string,
    code?: string,
    res?: any,
    ip?: string,
    userAgent?: string,
  ) {
    if (!token && !code) {
      throw new BadRequestException('Verification token or code is required');
    }
    // Load verification records
    const recs = await this.verificationModel
      .find({ used: false, expiresAt: { $gt: new Date() } })
      .exec();
    let match: any = null;
    for (const r of recs) {
      if (token) {
        try {
          if (await argon2.verify(r.tokenHash, token)) {
            match = r;
            break;
          }
        } catch {}
      }
      if (code) {
        try {
          if (r.codeHash && (await argon2.verify(r.codeHash, code))) {
            match = r;
            break;
          }
        } catch {}
      }
    }
    if (!match) throw new UnauthorizedException('Invalid or expired verification');
    const user = await this.userModel.findById(match.userId).exec();
    if (!user) throw new UnauthorizedException('Invalid verification');
    // If confirming as logged-in user, ensure same user
    if (currentUser && String(currentUser._id) !== String(user._id)) {
      throw new UnauthorizedException('Invalid verification');
    }

    user.emailVerifiedAt = new Date();
    await user.save();
    match.used = true;
    match.usedAt = new Date();
    await match.save();

    // Issue a fresh auth session so the user can land directly in dashboard
    // after email verification without an extra login step.
    if (res) {
      const accessToken = this.signAccessToken(user as any);
      const refreshToken = this.newRefreshToken();
      await this.createSession(user._id as any, refreshToken, ip, userAgent);
      this.setAuthCookies(res, accessToken, refreshToken);
      this.setUserDataCookie(res, user as any);

      const resolvedRole = this.resolveUserRole(user as any);

      return {
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          user_type: user.user_type,
          organization_id: user.organization_id,
          isPrimary: user.isPrimary,
          emailVerifiedAt: user.emailVerifiedAt || null,
          role: resolvedRole,
        },
        accessToken,
      };
    }

    return { success: true };
  }

  async refresh(res: any, refreshTokenFromCookie: string, ip?: string, userAgent?: string) {
    if (!refreshTokenFromCookie) throw new UnauthorizedException('Missing refresh token');
    const sessions = await this.sessionModel.find({ revoked: false }).exec();
    let owner: Session | null = null;
    for (const s of sessions) {
      try {
        if (await argon2.verify(s.refreshTokenHash, refreshTokenFromCookie)) {
          owner = s as any;
          break;
        }
      } catch {}
    }
    if (!owner || owner.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid session');
    }
    const user = await this.userModel.findById(owner.userId).exec();
    if (!user) throw new UnauthorizedException('Invalid session');
    if ((user as any).deleted || user.isDisabled) {
      throw new UnauthorizedException('Account is disabled');
    }

    // rotate refresh token
    owner.revoked = true;
    owner.revokedAt = new Date();
    await owner.save();
    const newRefresh = this.newRefreshToken();
    await this.createSession(user._id as any, newRefresh, ip, userAgent);
    const newAccess = this.signAccessToken(user as any);
    this.setAuthCookies(res, newAccess, newRefresh);
    return { accessToken: newAccess };
  }

  async logout(res: any, refreshTokenFromCookie: string) {
    if (refreshTokenFromCookie) {
      const sessions = await this.sessionModel.find({ revoked: false }).exec();
      for (const s of sessions) {
        try {
          if (await argon2.verify(s.refreshTokenHash, refreshTokenFromCookie)) {
            s.revoked = true;
            s.revokedAt = new Date();
            await s.save();
            break;
          }
        } catch {}
      }
    }
    this.clearAuthCookies(res);
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid email');
    } // do not leak
    const raw = this.newRefreshToken();
    const hash = await argon2.hash(raw, { type: argon2.argon2id });
    const pr = new this.passwordResetModel({
      userId: user._id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await pr.save();
    try {
      await this.authEmailService.sendPasswordResetEmail(user.email, raw, 1, { queue: false });
    } catch (e) {
      // swallow to avoid leaking
    }
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { token, password } = dto;
    const candidates = await this.passwordResetModel
      .find({ used: false, expiresAt: { $gt: new Date() } })
      .exec();
    let match: PasswordReset | null = null;
    for (const c of candidates) {
      try {
        if (await argon2.verify(c.tokenHash, token)) {
          match = c;
          break;
        }
      } catch {}
    }
    if (!match) throw new UnauthorizedException('Invalid or expired token');
    const user = await this.userModel.findById(match.userId).select('+password').exec();
    if (!user) throw new UnauthorizedException('Invalid token');
    user.password = await this.hashPassword(password);
    await user.save();
    match.used = true;
    match.usedAt = new Date();
    await match.save();
    // revoke all sessions for this user
    await this.sessionModel
      .updateMany(
        { userId: user._id, revoked: false },
        { $set: { revoked: true, revokedAt: new Date() } },
      )
      .exec();
    return { success: true };
  }

  async listSessions(currentUser: UserDocument) {
    const sessions = await this.sessionModel
      .find({ userId: currentUser._id, revoked: false })
      .select('_id ip userAgent createdAt expiresAt')
      .sort({ createdAt: -1 })
      .exec();
    return { data: sessions };
  }

  async revokeAllSessions(currentUser: UserDocument) {
    await this.sessionModel
      .updateMany(
        { userId: currentUser._id, revoked: false },
        { $set: { revoked: true, revokedAt: new Date() } },
      )
      .exec();
    return { success: true };
  }

  async revokeSession(id: string, currentUser: UserDocument) {
    const s = await this.sessionModel.findOne({ _id: id, userId: currentUser._id }).exec();
    if (!s) throw new NotFoundException('Session not found');
    if (!s.revoked) {
      s.revoked = true;
      s.revokedAt = new Date();
      await s.save();
    }
    return { success: true };
  }
}
