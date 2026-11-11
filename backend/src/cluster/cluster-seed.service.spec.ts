import { Test, TestingModule } from '@nestjs/testing';

import { ClusterSeedService } from './cluster-seed.service';
import { ClusterRepository } from './repositories/cluster.repository';
import { DEFAULT_CLUSTERS } from './clusters.seed';
import { LoggerService } from '../common/logger/logger.service';

describe('ClusterSeedService', () => {
  const previousSeedValue = process.env.SEED_DEFAULT_CLUSTERS;
  let clusterRepository: {
    findByName: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: ClusterSeedService;

  beforeEach(async () => {
    clusterRepository = {
      findByName: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClusterSeedService,
        { provide: ClusterRepository, useValue: clusterRepository },
        { provide: LoggerService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = module.get(ClusterSeedService);
  });

  afterAll(() => {
    if (previousSeedValue === undefined) {
      delete process.env.SEED_DEFAULT_CLUSTERS;
    } else {
      process.env.SEED_DEFAULT_CLUSTERS = previousSeedValue;
    }
  });

  it('does not add example clusters unless explicitly enabled', async () => {
    delete process.env.SEED_DEFAULT_CLUSTERS;

    await service.onModuleInit();

    expect(clusterRepository.findByName).not.toHaveBeenCalled();
    expect(clusterRepository.save).not.toHaveBeenCalled();
  });

  it('adds example clusters when enabled for development', async () => {
    process.env.SEED_DEFAULT_CLUSTERS = 'true';
    clusterRepository.findByName.mockResolvedValue(null);
    clusterRepository.save.mockImplementation(async (cluster) => cluster);

    await service.onModuleInit();

    expect(clusterRepository.findByName).toHaveBeenCalledTimes(
      DEFAULT_CLUSTERS.length,
    );
    expect(clusterRepository.save).toHaveBeenCalledTimes(
      DEFAULT_CLUSTERS.length,
    );
  });
});
