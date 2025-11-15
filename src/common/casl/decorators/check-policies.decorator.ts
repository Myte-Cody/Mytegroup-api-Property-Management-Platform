import { SetMetadata } from '@nestjs/common';
import { PolicyHandler } from '../guards/casl.guard';

export const CHECK_POLICIES_KEY = 'check_policy';

/**
 * Decorator to define policies that should be checked for an endpoint
 * @param handlers Array of policy handlers to check
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
