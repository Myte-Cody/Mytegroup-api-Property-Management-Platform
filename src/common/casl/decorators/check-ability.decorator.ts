import { ForbiddenException } from '@nestjs/common';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Helper function to check CASL abilities at the service level
 * @param ability The user's CASL ability instance
 * @param action The action to check (read, create, update, delete, manage)
 * @param subject The subject (resource type or instance) to check against
 * @param message Optional custom error message
 */
export function checkAbility(
  ability: AppAbility,
  action: Action,
  subject: any,
  message?: string,
): void {
  if (!ability.can(action, subject)) {
    throw new ForbiddenException(message || `You are not allowed to ${action} this resource`);
  }
}

/**
 * Helper function to check if a user can perform an action on a subject
 * @param ability The user's CASL ability instance
 * @param action The action to check
 * @param subject The subject to check against
 * @returns boolean indicating if the action is allowed
 */
export function canPerform(ability: AppAbility, action: Action, subject: any): boolean {
  return ability.can(action, subject);
}
