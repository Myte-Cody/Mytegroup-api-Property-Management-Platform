import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from '../../../features/properties/schemas/property.schema';
import { Unit } from '../../../features/properties/schemas/unit.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { CaslAbilityFactory } from '../casl-ability.factory';
import { CHECK_POLICIES_KEY } from '../decorators/check-policies.decorator';

export interface IPolicyHandler {
  handle(ability: any, user: any, resource?: any): boolean;
}

type PolicyHandlerCallback = (ability: any, user: any, resource?: any) => boolean;

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Unit.name) private unitModel: Model<Unit>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getHandler()) || [];

    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check if user has proper tenant context
    const landlordId =
      user.tenantId && typeof user.tenantId === 'object'
        ? (user.tenantId as any)._id
        : user.tenantId;

    if (!landlordId) {
      return false;
    }
    const ability = this.caslAbilityFactory.createForUser(user);

    const resource = await this.getResource(request, context);

    for (const handler of policyHandlers) {
      const allowed = this.execPolicyHandler(handler, ability, user, resource);
      if (!allowed) {
        throw new ForbiddenException('Access denied');
      }
    }

    return true;
  }

  private execPolicyHandler(
    handler: PolicyHandler,
    ability: any,
    user: any,
    resource?: any,
  ): boolean {
    if (typeof handler === 'function') {
      return handler(ability, user, resource);
    }
    return handler.handle(ability, user, resource);
  }

  private async getResource(request: any, context: ExecutionContext): Promise<any> {
    // todo review this hacky logic
    const params = request.params;
    const body = request.body;

    // Helper function to validate MongoDB ObjectId
    const isValidObjectId = (id: string): boolean => {
      return /^[0-9a-fA-F]{24}$/.test(id);
    };

    // Try to determine what resource we're dealing with based on the route
    const routePath = context.getClass().name.toLowerCase();

    if (routePath.includes('property') || routePath.includes('properties')) {
      if (params.id && isValidObjectId(params.id)) {
        return await this.propertyModel.findById(params.id).exec();
      }
      if (body?.property && isValidObjectId(body.property)) {
        return await this.propertyModel.findById(body.property).exec();
      }
    }

    if (routePath.includes('unit')) {
      if (params.id && isValidObjectId(params.id)) {
        return await this.unitModel.findById(params.id).populate('property').exec();
      }
      if (body?.unit && isValidObjectId(body.unit)) {
        return await this.unitModel.findById(body.unit).populate('property').exec();
      }
    }

    if (routePath.includes('user')) {
      if (params.id && isValidObjectId(params.id)) {
        return await this.userModel.findById(params.id).exec();
      }
      if (body) return body;
    }

    return null;
  }
}
