import { Test, TestingModule } from '@nestjs/testing';
import { ClusterService } from './cluster.service';
import { ClusterRepository } from './repositories/cluster.repository';

describe('ClusterService', () => {
  let service: ClusterService;
  let clusterRepository: {
    findByName: jest.Mock;
    findByDeviceId: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    clusterRepository = {
      findByName: jest.fn().mockResolvedValue(null),
      findByDeviceId: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (cluster) => ({ id: cluster.id ?? 4, ...cluster })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClusterService,
        {
          provide: ClusterRepository,
          useValue: clusterRepository,
        },
      ],
    }).compile();

    service = module.get<ClusterService>(ClusterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('assigns the cluster id as a unique deviceId when none is provided', async () => {
    const cluster = await service.create({ name: 'Nuevo cluster' });

    expect(cluster.deviceId).toBe('4');
    expect(clusterRepository.save).toHaveBeenCalledTimes(2);
  });
});
