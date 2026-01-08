import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenancyContextService } from '../../../common/services/tenancy-context.service';

/**
 * Guard that restricts access to SUPER_ADMIN users only.
 * Used for all admin panel endpoints to ensure only platform admins can access.
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private readonly tenancyContextService: TenancyContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!this.tenancyContextService.isSuperAdmin(user)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
