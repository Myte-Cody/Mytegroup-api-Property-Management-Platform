import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import {
  CreateContactInquiryDto,
  CreateInquiryDto,
  ReplyToInquiryDto,
  VerifyContactInquiryDto,
} from './dto/create-inquiry.dto';
import { InquiryQueryDto } from './dto/inquiry-query.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('Inquiries')
@Public()
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new inquiry (public endpoint)' })
  @ApiBody({ type: CreateInquiryDto, description: 'Inquiry data to create' })
  create(@Body() createInquiryDto: CreateInquiryDto) {
    return this.inquiriesService.create(createInquiryDto);
  }

  @Post('contact')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary: 'Create a contact inquiry (public endpoint with email verification)',
    description:
      'For authenticated tenants, the inquiry is linked to their account. For unauthenticated users with existing accounts, inquiry is submitted directly. For new users, a verification code is sent to their email.',
  })
  @ApiBody({ type: CreateContactInquiryDto, description: 'Contact inquiry data' })
  createContactInquiry(@Body() dto: CreateContactInquiryDto, @Req() req: Request) {
    // Get authenticated user ID if available (OptionalJwtGuard populates req.user if token is valid)
    const authenticatedUserId = (req as any).user?.sub || (req as any).user?._id;
    return this.inquiriesService.createContactInquiry(dto, authenticatedUserId);
  }

  @Post('contact/verify')
  @ApiOperation({
    summary: 'Verify email and submit contact inquiry',
    description: 'Verify the 6-digit code sent to the email to complete the inquiry submission.',
  })
  @ApiBody({ type: VerifyContactInquiryDto, description: 'Verification data' })
  verifyContactInquiry(@Body() dto: VerifyContactInquiryDto) {
    return this.inquiriesService.verifyContactInquiry(dto);
  }

  @Post('contact/:id/resend')
  @ApiOperation({
    summary: 'Resend verification code',
    description: 'Resend the verification code for a pending inquiry.',
  })
  @ApiParam({ name: 'id', description: 'Inquiry ID', type: String })
  resendVerificationCode(@Param('id', MongoIdValidationPipe) id: string) {
    return this.inquiriesService.resendVerificationCode(id);
  }

  @Post(':id/reply')
  @ApiOperation({
    summary: 'Reply to an inquiry (landlord only)',
    description: 'Send a reply to the inquirer. The reply will be sent via email.',
  })
  @ApiParam({ name: 'id', description: 'Inquiry ID', type: String })
  @ApiBody({ type: ReplyToInquiryDto, description: 'Reply content' })
  replyToInquiry(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() dto: ReplyToInquiryDto,
  ) {
    return this.inquiriesService.replyToInquiry(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inquiries' })
  findAll(@Query() queryDto: InquiryQueryDto) {
    return this.inquiriesService.findAllPaginated(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inquiry by ID' })
  @ApiParam({ name: 'id', description: 'Inquiry ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string) {
    return this.inquiriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inquiry by ID' })
  @ApiParam({ name: 'id', description: 'Inquiry ID', type: String })
  @ApiBody({
    type: UpdateInquiryDto,
    description: 'Fields to update on the inquiry. All fields are optional.',
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateInquiryDto: UpdateInquiryDto,
  ) {
    return this.inquiriesService.update(id, updateInquiryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete inquiry by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Inquiry ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string) {
    return this.inquiriesService.remove(id);
  }
}
