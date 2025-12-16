import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CheckFavoritesDto, FavoriteQueryDto } from './dto/favorite-query.dto';
import { FavoritesService } from './favorites.service';

interface AuthUser {
  _id: string;
  email: string;
}

@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Add a unit to favorites' })
  @ApiBody({ type: CreateFavoriteDto, description: 'Unit ID to add to favorites' })
  create(@CurrentUser() user: AuthUser, @Body() createFavoriteDto: CreateFavoriteDto) {
    return this.favoritesService.create(user._id, createFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all favorites for the current user' })
  findAll(@CurrentUser() user: AuthUser, @Query() queryDto: FavoriteQueryDto) {
    return this.favoritesService.findAll(user._id, queryDto);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if units are favorited (bulk check)' })
  @ApiQuery({
    name: 'unitIds',
    description: 'Array of unit IDs to check',
    type: [String],
    required: false,
  })
  async checkFavorites(@CurrentUser() user: AuthUser, @Query() query: CheckFavoritesDto) {
    const result = await this.favoritesService.checkFavorites(user._id, query.unitIds || []);
    return {
      success: true,
      data: result,
    };
  }

  @Get('check/:unitId')
  @ApiOperation({ summary: 'Check if a single unit is favorited' })
  @ApiParam({ name: 'unitId', description: 'Unit ID to check', type: String })
  async isFavorite(
    @CurrentUser() user: AuthUser,
    @Param('unitId', MongoIdValidationPipe) unitId: string,
  ) {
    const isFavorited = await this.favoritesService.isFavorite(user._id, unitId);
    return {
      success: true,
      data: { isFavorited },
    };
  }

  @Delete(':unitId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a unit from favorites' })
  @ApiParam({ name: 'unitId', description: 'Unit ID to remove from favorites', type: String })
  remove(@CurrentUser() user: AuthUser, @Param('unitId', MongoIdValidationPipe) unitId: string) {
    return this.favoritesService.remove(user._id, unitId);
  }
}
