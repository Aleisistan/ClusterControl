import { Test, TestingModule } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { Cluster } from './entities/cluster.entity';
import { ClusterService } from './cluster.service';
import { ClusterRepository } from './repositories/cluster.repository';

describe('ClusterService', () => {
  let service: ClusterService;
  let clusterRepository: {
    findByName: jest.Mock;
    findByDeviceId: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    clusterRepository = {
      findByName: jest.fn().mockResolvedValue(null),
      findByDeviceId: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue({ id: 4 }),
      create: jest.fn((data: Partial<Cluster>) => ({ ...data })),
      save: jest.fn((cluster: Partial<Cluster>) =>
        Promise.resolve({ id: cluster.id ?? 4, ...cluster }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
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

  it('returns a conflict instead of a server error when related data prevents deletion', async () => {
    const driverError = Object.assign(new Error('foreign key violation'), {
      code: '23503',
    });
    clusterRepository.delete.mockRejectedValue(
      new QueryFailedError('DELETE', [], driverError),
    );

    await expect(service.delete(4)).rejects.toThrow(
      'No se puede eliminar el cluster porque tiene datos relacionados.',
    );
  });
});
