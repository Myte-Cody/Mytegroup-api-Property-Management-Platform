import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { MongoIdDto } from "../../common/dto/mongo-id.dto";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiProperty } from "@nestjs/swagger";

@ApiTags('Organizations')
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiBody({ type: CreateOrganizationDto })
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return await this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations' })
  async findAll() {
    return await this.organizationsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  async findOne(@Param() params: MongoIdDto) {
    const organization = await this.organizationsService.findOne(params.id);
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${params.id} not found`);
    }
    return organization;
  }

  @Patch(":id")
  @ApiOperation({ summary: 'Update organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  @ApiBody({ type: UpdateOrganizationDto })
  async update(
    @Param() params: MongoIdDto,
    @Body() updateOrganizationDto: UpdateOrganizationDto
  ) {
    return await this.organizationsService.update(params.id, updateOrganizationDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  async remove(@Param() params: MongoIdDto) {
    return await this.organizationsService.remove(params.id);
  }
}
