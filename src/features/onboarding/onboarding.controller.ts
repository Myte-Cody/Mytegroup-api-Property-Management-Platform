import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { InvitationsService } from '../invitations/invitations.service';
import { EntityType } from '../invitations/schemas/invitation.schema';
import { Landlord } from '../landlords/schema/landlord.schema';
import { PropertiesService } from '../properties/properties.service';
import { UnitsService } from '../properties/units.service';
import { UserDocument } from '../users/schemas/user.schema';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { InviteTenantDto } from './dto/invite-tenant.dto';
import { OnboardingStateDto } from './dto/onboarding-state.dto';

@ApiTags('onboarding')
@ApiBearerAuth('JWT-auth')
@Controller('onboarding')
export class OnboardingController {
  constructor(
    @InjectModel(Landlord.name) private readonly landlordModel: AppModel<Landlord>,
    private readonly propertiesService: PropertiesService,
    private readonly unitsService: UnitsService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('org')
  @ApiOperation({ summary: 'Update organization info for current landlord' })
  async updateOrg(@Body() body: { name: string }, @CurrentUser() user: UserDocument) {
    if (user.user_type !== 'Landlord') {
      return { success: false, message: 'Only landlords can update org info' };
    }
    await this.landlordModel
      .updateOne({ _id: user.organization_id }, { $set: { name: body.name } })
      .exec();
    return { success: true };
  }

  @Get('state')
  @ApiOperation({ summary: 'Get high-level onboarding state for current landlord' })
  async getOnboardingState(@CurrentUser() user: UserDocument): Promise<OnboardingStateDto> {
    if (user.user_type !== 'Landlord') {
      return {
        hasProperties: false,
        hasUnits: false,
        hasTenants: false,
        hasContractors: false,
        hasTickets: false,
      };
    }

    const [propertiesAgg, tenantsCount, contractorsCount, ticketsCount] = await Promise.all([
      this.propertiesService.countByLandlord(user.organization_id as any),
      this.landlordModel.db
        .model('Tenant')
        .countDocuments()
        .exec()
        .catch(() => 0),
      this.landlordModel.db
        .model('Contractor')
        .countDocuments()
        .exec()
        .catch(() => 0),
      this.landlordModel.db
        .model('MaintenanceTicket')
        .countDocuments()
        .exec()
        .catch(() => 0),
    ]);

    const hasProperties = propertiesAgg.totalProperties > 0;
    const hasUnits = propertiesAgg.totalUnits > 0;

    return {
      hasProperties,
      hasUnits,
      hasTenants: tenantsCount > 0,
      hasContractors: contractorsCount > 0,
      hasTickets: ticketsCount > 0,
    };
  }

  @Post('property')
  @ApiOperation({ summary: 'Create first property' })
  async createProperty(@Body() dto: any, @CurrentUser() user: UserDocument) {
    return this.propertiesService.create(dto, user);
  }

  @Post('unit')
  @ApiOperation({ summary: 'Create unit for property' })
  async createUnit(@Body() dto: any, @CurrentUser() user: UserDocument) {
    const { propertyId, ...unit } = dto;
    return this.unitsService.create(unit, propertyId, user);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Invite landlord staff via onboarding' })
  async inviteStaff(@Body() body: InviteStaffDto, @CurrentUser() user: UserDocument) {
    if (user.user_type !== 'Landlord') {
      throw new ForbiddenException('Only landlords can invite staff members');
    }

    const organizationId = user.organization_id?.toString();
    if (!organizationId) {
      throw new BadRequestException('Organization context is required for staff invitations');
    }

    const landlord = await this.landlordModel.findById(organizationId).exec();
    const invitedByName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    return this.invitationsService.create(
      {
        entityType: EntityType.LANDLORD_STAFF,
        email: body.email,
        entityData: {
          organizationId,
          organizationName: landlord?.name,
          invitedByName,
          source: 'onboarding',
        },
      },
      user,
    );
  }

  @Post('tenant')
  @ApiOperation({ summary: 'Invite tenant (captures property/unit metadata)' })
  async inviteTenant(@Body() body: InviteTenantDto, @CurrentUser() user: UserDocument) {
    if (user.user_type !== 'Landlord') {
      throw new ForbiddenException('Only landlords can invite tenants');
    }

    const entityData: Record<string, any> = {
      source: 'onboarding',
    };

    if (body.propertyId) {
      entityData.propertyId = body.propertyId;
      try {
        const property = await this.propertiesService.findOne(body.propertyId, user);
        entityData.propertyName = property?.name;
      } catch {
        // Ignore lookup failures; invitation can still proceed
      }
    }

    if (body.unitId) {
      entityData.unitId = body.unitId;
      try {
        const unit: any = await this.unitsService.findOne(body.unitId, user);
        entityData.unitLabel = unit?.unitNumber || unit?.name;
      } catch {
        // ignore
      }
    }

    return this.invitationsService.create(
      {
        entityType: EntityType.TENANT,
        email: body.email,
        entityData,
      },
      user,
    );
  }
}
