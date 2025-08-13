import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MongoIdDto } from '../../common/dto/mongo-id.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@ApiTags('Units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new unit' })
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitsService.create(createUnitDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all units' })
  findAll() {
    return this.unitsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  findOne(@Param() params: MongoIdDto) {
    return this.unitsService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  update(@Param() params: MongoIdDto, @Body() updateUnitDto: UpdateUnitDto) {
    return this.unitsService.update(params.id, updateUnitDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete unit by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  remove(@Param() params: MongoIdDto) {
    return this.unitsService.remove(params.id);
  }
}
