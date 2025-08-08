import { Injectable } from '@nestjs/common';
@Injectable()
export class EmailService {
  sendMail(dto: any) { console.log('Sending email to', dto.email); }
}
