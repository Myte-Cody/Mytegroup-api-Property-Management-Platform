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
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
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
