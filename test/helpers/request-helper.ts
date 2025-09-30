import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export class RequestHelper {
  constructor(private readonly app: INestApplication) {}

  getServer() {
    return this.app.getHttpServer();
  }

  get(url: string, token?: string) {
    const req = request(this.getServer()).get(url);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  post(url: string, data: any, token?: string) {
    const req = request(this.getServer()).post(url).send(data);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  put(url: string, data: any, token?: string) {
    const req = request(this.getServer()).put(url).send(data);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  patch(url: string, data: any, token?: string) {
    const req = request(this.getServer()).patch(url).send(data);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  delete(url: string, token?: string) {
    const req = request(this.getServer()).delete(url);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }
}
