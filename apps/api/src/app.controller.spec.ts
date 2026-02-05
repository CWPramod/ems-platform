import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: { get: (key: string, def?: any) => def },
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status', async () => {
      const result = await appController.getHealth();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
