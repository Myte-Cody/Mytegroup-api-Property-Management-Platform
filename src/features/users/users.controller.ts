import {
  Controller,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
@Controller("users")
export class UsersController {
  constructor(private svc: UsersService) {}
  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.svc.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.svc.update(id, updateUserDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}
