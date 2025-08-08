import { Injectable } from '@nestjs/common';
@Injectable()
export class OrganizationsService { create(dto: any) { return { id: 1, ...dto }; } }
