import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}
  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }
}
