import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login')
  login(@Body() body: any) { return this.auth.login(body.email, body.password); }
}
