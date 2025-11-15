import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      return true;
    }

    const method = (request.method || 'GET').toUpperCase();

    // Skip CSRF validation for safe methods and @Public routes
    if (isPublic || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const csrfCookie = this.getCookie(request, 'csrf_token');
    const csrfHeader = (request.headers['x-csrf-token'] as string) || '';

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  private getCookie(req: Request, key: string): string | undefined {
    const cookieJar = (req as any).cookies;
    if (cookieJar && cookieJar[key]) {
      return cookieJar[key];
    }

    const rawCookie = req.headers?.cookie;
    if (!rawCookie) {
      return undefined;
    }

    const parsed = rawCookie.split(';').map((segment) => segment.trim());
    for (const entry of parsed) {
      const [cookieKey, ...value] = entry.split('=');
      if (cookieKey === key) {
        return decodeURIComponent(value.join('=')); // Handles equals in value
      }
    }
    return undefined;
  }
}

