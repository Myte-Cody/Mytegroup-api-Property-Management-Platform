import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiBody } from "@nestjs/swagger";
import { MongoIdDto } from "../../common/dto/mongo-id.dto";
import { PropertiesService } from "./properties.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";

@ApiTags("Properties")
@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new property" })
  @ApiBody({ type: CreatePropertyDto, description: "Property data to create" })
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all properties" })
  findAll() {
    return this.propertiesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get property by ID" })
  @ApiParam({ name: "id", description: "Property ID", type: String })
  findOne(@Param() params: MongoIdDto) {
    return this.propertiesService.findOne(params.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update property by ID" })
  @ApiParam({ name: "id", description: "Property ID", type: String })
  @ApiBody({
    type: UpdatePropertyDto,
    description: "Fields to update on the property. All fields are optional.",
  })
  update(
    @Param() params: MongoIdDto,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(params.id, updatePropertyDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete property by ID (soft delete)" })
  @ApiParam({ name: "id", description: "Property ID", type: String })
  remove(@Param() params: MongoIdDto) {
    return this.propertiesService.remove(params.id);
  }
}
