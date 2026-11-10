import { Test, TestingModule } from '@nestjs/testing';
import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';
import { CameraStreamService } from './camera-stream.service';
import { LoggerService } from '../common/logger/logger.service';

describe('CameraController', () => {
  let controller: CameraController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CameraController],
      providers: [
        {
          provide: CameraService,
          useValue: {},
        },
        {
          provide: CameraStreamService,
          useValue: {},
        },
        {
          provide: LoggerService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CameraController>(CameraController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
