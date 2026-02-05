import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { PasswordPolicyService } from '../src/auth/password-policy.service';
import { SessionManagerService } from '../src/auth/session-manager.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/entities/user.entity';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        PasswordPolicyService,
        SessionManagerService,
        Reflector,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ userId: 1, username: 'admin' }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const authHeader = req.headers?.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            req.user = { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
            return true;
          }
          throw new UnauthorizedException();
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/auth/login with valid creds should return 201 with accessToken', async () => {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);

    mockUserRepo.findOne.mockResolvedValue({
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      password: hashedPassword,
      roleId: 1,
      role: { id: 1, name: 'admin' },
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      forcePasswordChange: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123456' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.sessionToken).toBeDefined();
  });

  it('POST /api/v1/auth/login with bad creds should return 401', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'nobody', password: 'wrong' })
      .expect(401);
  });

  it('GET /api/v1/auth/health should return 200 without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('auth');
  });

  it('POST /api/v1/auth/logout without auth should return 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .expect(401);
  });

  it('POST /api/v1/auth/change-password without auth should return 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'New@12345' })
      .expect(401);
  });
});
