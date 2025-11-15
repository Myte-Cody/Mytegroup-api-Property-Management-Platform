import { INestApplication, Controller, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { CsrfGuard } from '../../../src/common/guards/csrf.guard';

@Controller('csrf-test')
class CsrfTestController {
  @Post()
  create() {
    return { ok: true };
  }
}

describe('CsrfGuard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CsrfTestController],
      providers: [
        CsrfGuard,
        {
          provide: APP_GUARD,
          useClass: CsrfGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects POST without CSRF token', async () => {
    await request(app.getHttpServer()).post('/csrf-test').send({}).expect(403);
  });

  it('allows POST with matching CSRF token', async () => {
    const csrfToken = 'test-token';

    await request(app.getHttpServer())
      .post('/csrf-test')
      .set('Cookie', `csrf_token=${csrfToken}`)
      .set('x-csrf-token', csrfToken)
      .send({})
      .expect(201)
      .expect({ ok: true });
  });
});
