import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Run the JWT strategy but never block the request if it fails.
    const result = super.canActivate(context) as boolean | Promise<boolean>;

    if (result instanceof Promise) {
      return result.then(() => true).catch(() => true);
    }

    return true;
  }

  handleRequest(err: any, user: any) {
    // Ignore errors, just return user if present.
    if (err) {
      return null;
    }
    return user || null;
  }
}
