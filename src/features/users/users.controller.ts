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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Multer } from 'multer';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateUserPolicyHandler,
  DeleteUserPolicyHandler,
  ReadUserPolicyHandler,
  UpdateUserPolicyHandler,
} from '../../common/casl/policies/user.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(CaslGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  @CheckPolicies(new CreateUserPolicyHandler())
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  async create(@CurrentUser() currentUser: User, @Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto, null, currentUser);
  }

  @Get()
  @CheckPolicies(new ReadUserPolicyHandler())
  @ApiOperation({ summary: 'Get all users with pagination, sorting and filtering' })
  findAll(@CurrentUser() currentUser: User, @Query() queryDto: UserQueryDto) {
    return this.userService.findAllPaginated(queryDto, currentUser);
  }

  @Get(':id')
  @CheckPolicies(new ReadUserPolicyHandler())
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateUserPolicyHandler())
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Fields to update on the user. All fields are optional.',
  })
  update(
    @CurrentUser() currentUser: User,
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteUserPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string) {
    return this.userService.remove(id);
  }

  @Post(':id/profile-picture')
  @CheckPolicies(new UpdateUserPolicyHandler())
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile picture for a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async uploadProfilePicture(
    @CurrentUser() currentUser: User,
    @Param('id', MongoIdValidationPipe) id: string,
    @UploadedFile() file: Multer.File,
  ) {
    const updatedUser = await this.userService.uploadProfilePicture(id, file, currentUser);
    return {
      success: true,
      data: updatedUser,
    };
  }

  @Get(':id/profile-picture')
  @CheckPolicies(new ReadUserPolicyHandler())
  @ApiOperation({ summary: 'Get profile picture URL for a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async getProfilePicture(@Param('id', MongoIdValidationPipe) id: string) {
    const profilePicture = await this.userService.getProfilePicture(id);
    return {
      success: true,
      data: { profilePicture },
    };
  }
}
