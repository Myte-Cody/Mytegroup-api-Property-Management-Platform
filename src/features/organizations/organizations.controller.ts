import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";

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
}
