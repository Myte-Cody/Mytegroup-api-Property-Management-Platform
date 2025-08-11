import { Injectable } from "@nestjs/common";
@Injectable()
export class UsersService {
  create(dto: any) {
    return { id: 1, ...dto };
  }

  //TODO: implement other methods
}
