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
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return await this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  async findAll() {
    return await this.organizationsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const organization = await this.organizationsService.findOne(id);
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return organization;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto
  ) {
    return await this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    return await this.organizationsService.remove(id);
  }
}
