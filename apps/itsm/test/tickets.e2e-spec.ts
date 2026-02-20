import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RedisConsumerService } from '../src/events/redis-consumer.service';
import { RedisPublisherService } from '../src/events/redis-publisher.service';
import { REDIS_CLIENT } from '../src/events/redis.provider';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let createdTicketId: string;

  const mockRedis = {
    xadd: jest.fn().mockResolvedValue('mock-id'),
    xreadgroup: jest.fn().mockResolvedValue(null),
    xgroup: jest.fn().mockResolvedValue('OK'),
    xack: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };

  const mockUser = { userId: '1', username: 'testuser', email: 'test@test.com', roleId: 1 };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(RedisConsumerService)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/itsm/tickets', () => {
    it('should create a ticket', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/itsm/tickets')
        .send({
          title: 'Test Incident',
          description: 'Server is down',
          type: 'incident',
          severity: 'critical',
          priority: 'P1',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('ticketNumber');
      expect(res.body.ticketNumber).toMatch(/^INC-\d{8}-\d{4}$/);
      expect(res.body.status).toBe('open');
      expect(res.body.severity).toBe('critical');
      createdTicketId = res.body.id;
    });

    it('should reject invalid ticket type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/itsm/tickets')
        .send({
          title: 'Bad Ticket',
          type: 'invalid',
          severity: 'critical',
          priority: 'P1',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/itsm/tickets', () => {
    it('should list tickets with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/itsm/tickets')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter tickets by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/itsm/tickets')
        .query({ status: 'open' })
        .expect(200);

      for (const ticket of res.body.data) {
        expect(ticket.status).toBe('open');
      }
    });
  });

  describe('GET /api/v1/itsm/tickets/:id', () => {
    it('should get a ticket by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/itsm/tickets/${createdTicketId}`)
        .expect(200);

      expect(res.body.id).toBe(createdTicketId);
    });

    it('should return 404 for non-existent ticket', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/itsm/tickets/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /api/v1/itsm/tickets/:id/status (State Machine)', () => {
    it('should allow open → acknowledged', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/itsm/tickets/${createdTicketId}/status`)
        .send({ status: 'acknowledged' })
        .expect(200);

      expect(res.body.status).toBe('acknowledged');
    });

    it('should allow acknowledged → in_progress', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/itsm/tickets/${createdTicketId}/status`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(res.body.status).toBe('in_progress');
    });

    it('should reject in_progress → closed (not allowed)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/itsm/tickets/${createdTicketId}/status`)
        .send({ status: 'closed' })
        .expect(400);
    });

    it('should reject resolved without resolution notes', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/itsm/tickets/${createdTicketId}/status`)
        .send({ status: 'resolved' })
        .expect(400);
    });

    it('should allow in_progress → resolved with notes', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/itsm/tickets/${createdTicketId}/status`)
        .send({ status: 'resolved', resolutionNotes: 'Fixed the issue by restarting the service' })
        .expect(200);

      expect(res.body.status).toBe('resolved');
      expect(res.body.resolutionNotes).toBeTruthy();
    });

    it('should allow resolved → closed', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/itsm/tickets/${createdTicketId}/status`)
        .send({ status: 'closed' })
        .expect(200);

      expect(res.body.status).toBe('closed');
    });
  });

  describe('GET /api/v1/itsm/tickets/:id/history', () => {
    it('should return audit trail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/itsm/tickets/${createdTicketId}/history`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Should have recorded status transitions
      const statusChanges = res.body.filter((h: any) => h.fieldChanged === 'status');
      expect(statusChanges.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('POST /api/v1/itsm/tickets/:id/comments', () => {
    let openTicketId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/itsm/tickets')
        .send({
          title: 'Ticket for comments test',
          type: 'incident',
          severity: 'medium',
          priority: 'P3',
        })
        .expect(201);
      openTicketId = res.body.id;
    });

    it('should add a comment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/itsm/tickets/${openTicketId}/comments`)
        .send({ comment: 'Investigating the issue', visibility: 'internal' })
        .expect(201);

      expect(res.body.comment).toBe('Investigating the issue');
      expect(res.body.visibility).toBe('internal');
    });

    it('should list comments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/itsm/tickets/${openTicketId}/comments`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});
