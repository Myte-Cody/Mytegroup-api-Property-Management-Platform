import { Body, Controller, Get, Post, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Response } from 'express';
import { VerifyEmailConfirmDto } from './dto/verify-email.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Throttle } from '@nestjs/throttler';
import { Param } from '@nestjs/common';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('auth')
@ApiBearerAuth('JWT-auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiBody({ type: LoginDto })
  @Post('login')
  @Throttle({ login: { limit: 5, ttl: 60 } })
  login(@Body() loginDto: LoginDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    const ua = req.headers['user-agent'] as string;
    return this.authService.login(loginDto, res, ip, ua);
  }

  @Public()
  @ApiBody({ type: RegisterDto })
  @Post('register')
  @Throttle({ register: { limit: 3, ttl: 60 } })
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.registerLandlord(dto, res);
  }

  @Public()
  @Post('refresh')
  refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.['refresh_token'];
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    const ua = req.headers['user-agent'] as string;
    return this.authService.refresh(res, rt, ip, ua);
  }

  @Post('logout')
  logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.['refresh_token'];
    return this.authService.logout(res, rt);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ forgotPassword: { limit: 5, ttl: 60 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-email/request')
  @Throttle({ requestVerify: { limit: 3, ttl: 60 } })
  requestVerify(@CurrentUser() user: UserDocument) {
    return this.authService.requestEmailVerification(user);
  }

  @Public()
  @Post('verify-email/confirm')
  @UseGuards(OptionalJwtGuard)
  @Throttle({ confirmVerify: { limit: 10, ttl: 60 } })
  confirmVerify(
    @Body() dto: VerifyEmailConfirmDto,
    @CurrentUser() user: UserDocument,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    const ua = req.headers['user-agent'] as string;
    return this.authService.confirmEmailVerification(user ?? null, dto.token, dto.code, res, ip, ua);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for current user' })
  sessions(@CurrentUser() user: UserDocument) {
    return this.authService.listSessions(user);
  }

  @Post('sessions/revoke-all')
  @ApiOperation({ summary: 'Revoke all sessions for current user' })
  revokeAll(@CurrentUser() user: UserDocument) {
    return this.authService.revokeAllSessions(user);
  }

  @Post('sessions/:id/revoke')
  @ApiOperation({ summary: 'Revoke a specific session by ID' })
  revoke(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.authService.revokeSession(id, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  getCurrentUser(@Request() req) {
    return this.authService.getCurrentUser(req.user.id);
  }
}
