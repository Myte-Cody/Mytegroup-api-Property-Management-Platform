import { Injectable, UnauthorizedException } from '@nestjs/common';
@Injectable()
export class AuthService {
  login(email: string, pass: string) {
    if (email === 'test' && pass === 'pass') return { accessToken: 'token' };
    throw new UnauthorizedException();
  }
}
