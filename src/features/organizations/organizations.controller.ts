import { Controller, Post, Body } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
@Controller('organizations')
export class OrganizationsController {
  constructor(private svc: OrganizationsService) {}
  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }
}
