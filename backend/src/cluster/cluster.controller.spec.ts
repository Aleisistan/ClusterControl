import { Test, TestingModule } from '@nestjs/testing';
import { ClusterController } from './cluster.controller';
import { ClusterService } from './cluster.service';

describe('ClusterController', () => {
  let controller: ClusterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClusterController],
      providers: [
        {
          provide: ClusterService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ClusterController>(ClusterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
