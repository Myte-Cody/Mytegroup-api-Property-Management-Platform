import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { Unit } from '../properties/schemas/unit.schema';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteQueryDto, PaginatedFavoritesResponse } from './dto/favorite-query.dto';
import { Favorite } from './schemas/favorite.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<Favorite>,
    @InjectModel(Unit.name)
    private readonly unitModel: Model<Unit>,
  ) {}

  async create(userId: string, createFavoriteDto: CreateFavoriteDto) {
    // Validate unit exists and is published to marketplace
    const unit = await this.unitModel.findById(createFavoriteDto.unitId).exec();
    if (!unit) {
      throw new UnprocessableEntityException(`Unit with ID ${createFavoriteDto.unitId} not found`);
    }

    if (!unit.publishToMarketplace) {
      throw new UnprocessableEntityException('This unit is not available in the marketplace');
    }

    // Check if already favorited
    const existingFavorite = await this.favoriteModel
      .findOne({
        user: new Types.ObjectId(userId),
        unit: new Types.ObjectId(createFavoriteDto.unitId),
      })
      .exec();

    if (existingFavorite) {
      throw new ConflictException('Unit is already in favorites');
    }

    const newFavorite = new this.favoriteModel({
      user: new Types.ObjectId(userId),
      unit: new Types.ObjectId(createFavoriteDto.unitId),
    });

    const favorite = await newFavorite.save();

    return {
      success: true,
      data: { favorite },
      message: 'Unit added to favorites',
    };
  }

  async findAll(
    userId: string,
    queryDto: FavoriteQueryDto,
  ): Promise<PaginatedFavoritesResponse<Favorite>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;

    const baseQuery = this.favoriteModel.find({
      user: new Types.ObjectId(userId),
    });

    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'unit',
          populate: {
            path: 'property',
            select: 'name address images',
          },
        })
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse<Favorite>(favorites, total, page, limit);
  }

  async remove(userId: string, unitId: string) {
    const result = await this.favoriteModel
      .deleteOne({
        user: new Types.ObjectId(userId),
        unit: new Types.ObjectId(unitId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Favorite not found');
    }

    return {
      success: true,
      message: 'Unit removed from favorites',
    };
  }

  async checkFavorites(userId: string, unitIds: string[]): Promise<Record<string, boolean>> {
    if (!unitIds || unitIds.length === 0) {
      return {};
    }

    const favorites = await this.favoriteModel
      .find({
        user: new Types.ObjectId(userId),
        unit: { $in: unitIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('unit')
      .exec();

    const favoritedUnitIds = new Set(favorites.map((f) => f.unit.toString()));

    const result: Record<string, boolean> = {};
    for (const unitId of unitIds) {
      result[unitId] = favoritedUnitIds.has(unitId);
    }

    return result;
  }

  async isFavorite(userId: string, unitId: string): Promise<boolean> {
    const favorite = await this.favoriteModel
      .findOne({
        user: new Types.ObjectId(userId),
        unit: new Types.ObjectId(unitId),
      })
      .exec();

    return !!favorite;
  }
}
