import { Repository } from 'typeorm';

import { Cluster } from '../entities/cluster.entity';
import { ClusterRepository } from './cluster.repository';

describe('ClusterRepository', () => {
  let repository: jest.Mocked<
    Pick<Repository<Cluster>, 'find' | 'query'>
  >;
  let clusterRepository: ClusterRepository;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      query: jest.fn(),
    };
    clusterRepository = new ClusterRepository(repository as Repository<Cluster>);
  });

  it('adds the last real-device telemetry time to each cluster', async () => {
    repository.find.mockResolvedValue([
      { id: 12, name: 'Cluster conectado', cameras: [] } as Cluster,
      { id: 13, name: 'Cluster nuevo', cameras: [] } as Cluster,
    ]);
    repository.query.mockResolvedValue([
      {
        clusterId: 12,
        lastSeenAt: '2026-11-12T04:30:00.000Z',
      },
    ]);

    const clusters = await clusterRepository.findAll();

    expect(clusters.map(({ lastSeenAt }) => lastSeenAt)).toEqual([
      '2026-11-12T04:30:00.000Z',
      null,
    ]);
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE source = $1 AND cluster_id = ANY($2)"),
      ['device', [12, 13]],
    );
  });

  it('does not query telemetry when there are no clusters', async () => {
    repository.find.mockResolvedValue([]);

    await expect(clusterRepository.findAll()).resolves.toEqual([]);
    expect(repository.query).not.toHaveBeenCalled();
  });
});
