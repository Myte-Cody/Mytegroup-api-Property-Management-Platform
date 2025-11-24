import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Response } from 'express';
import type { UserDocument } from '../users/schemas/user.schema';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationQueryDto } from './dto/invitation-query.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new invitation',
    description: 'Send an invitation for a new entity (tenant, contractor, etc.)',
  })
  async create(
    @Body() createInvitationDto: CreateInvitationDto,
    @CurrentUser() currentUser: UserDocument,
  ) {
    return this.invitationsService.create(createInvitationDto, currentUser);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all invitations',
    description: "Retrieve a paginated list of invitations sent by the current user's organization",
  })
  async findAll(@Query() queryDto: InvitationQueryDto, @CurrentUser() currentUser: UserDocument) {
    return this.invitationsService.findAllPaginated(queryDto, currentUser);
  }

  @Public()
  @Get(':token/validate')
  @ApiOperation({
    summary: 'Validate invitation token',
    description: 'Check if an invitation token is valid and not expired',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token',
    type: 'string',
  })
  async validateToken(@Param('token') token: string) {
    const { invitation, existingUser, requiresForm } =
      await this.invitationsService.findByToken(token);
    return {
      invitation: {
        entityType: invitation.entityType,
        email: invitation.email,
        entityData: invitation.entityData,
        expiresAt: invitation.expiresAt,
      },
      existingUser,
      requiresForm,
    };
  }

  @Public()
  @Post(':token/accept')
  @ApiOperation({
    summary: 'Accept an invitation',
    description: 'Accept an invitation and create the corresponding entity and user account',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token',
    type: 'string',
  })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() acceptInvitationDto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.invitationsService.acceptInvitation(token, acceptInvitationDto, res);
  }

  @Patch(':id/revoke')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke an invitation',
    description: 'Revoke a pending invitation, preventing it from being accepted',
  })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID',
    type: 'string',
  })
  async revokeInvitation(@Param('id') id: string, @CurrentUser() currentUser: UserDocument) {
    await this.invitationsService.revokeInvitation(id, currentUser);
    return { message: 'Invitation revoked successfully' };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete an invitation',
    description: 'Permanently delete an invitation record',
  })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID',
    type: 'string',
  })
  async deleteInvitation(@Param('id') id: string, @CurrentUser() currentUser: UserDocument) {
    await this.invitationsService.deleteInvitation(id, currentUser);
    return { message: 'Invitation deleted successfully' };
  }
}
