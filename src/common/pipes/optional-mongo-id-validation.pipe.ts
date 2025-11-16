import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';

@Injectable()
export class OptionalMongoIdValidationPipe implements PipeTransform {
  transform(value: any) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (!isMongoId(value)) {
      throw new BadRequestException(`Invalid MongoDB ObjectId: ${value}`);
    }

    return value;
  }
}
