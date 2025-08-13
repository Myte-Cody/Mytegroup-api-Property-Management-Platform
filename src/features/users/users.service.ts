import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User } from "./schemas/user.schema";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import * as bcrypt from "bcrypt";
import { SoftDeleteModel } from "../../common/interfaces/soft-delete-model.interface";
import { Organization } from "../organizations/schemas/organization.schema";
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<User>,
    @InjectModel(Organization.name) private organizationModel: SoftDeleteModel<Organization>
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { username, email, password, organization } = createUserDto;

    // Check if username is already taken
    const existingUsername = await this.userModel.findOne({ username }).exec();
    if (existingUsername) {
      throw new BadRequestException(`Username '${username}' is already taken`);
    }

    // Check if email is already registered
    const existingEmail = await this.userModel.findOne({ email }).exec();
    if (existingEmail) {
      throw new BadRequestException(`Email '${email}' is already registered`);
    }

    // Validate organization exists if provided
    if (organization) {
      const existingOrganization = await this.organizationModel.findById(organization).exec();
      if (!existingOrganization) {
        throw new BadRequestException(`Organization with ID ${organization} does not exist`);
      }
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword
    });

    return await newUser.save();
  }

  async findAll() {
    return await this.userModel.find().exec();
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    

    // Check if username is being updated and is already taken by another user
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.userModel.findOne({ 
        username: updateUserDto.username,
        _id: { $ne: id }
      }).exec();
      
      if (existingUsername) {
        throw new BadRequestException(`Username '${updateUserDto.username}' is already taken`);
      }
    }
    
    // Check if email is being updated and is already registered by another user
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userModel.findOne({ 
        email: updateUserDto.email,
        _id: { $ne: id }
      }).exec();
      
      if (existingEmail) {
        throw new BadRequestException(`Email '${updateUserDto.email}' is already registered`);
      }
    }

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    await this.userModel.deleteById(id);
    
    return null;
  }
}
