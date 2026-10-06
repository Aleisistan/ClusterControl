import { Repository } from 'typeorm';
import { Telemetry } from '../telemetry.entity';
import { TelemetryRepository } from './telemetry.repository';

describe('TelemetryRepository', () => {
  it('returns the most recent limited samples in chronological order', async () => {
    const newestFirst = [
      { id: 3, created_at: new Date('2026-10-06T12:00:03Z') },
      { id: 2, created_at: new Date('2026-10-06T12:00:02Z') },
    ] as Telemetry[];
    const repository = {
      find: jest.fn().mockResolvedValue(newestFirst),
    } as unknown as Repository<Telemetry>;
    const telemetryRepository = new TelemetryRepository(repository);
    const from = new Date('2026-10-05T12:00:00Z');
    const to = new Date('2026-10-06T12:00:00Z');

    const result = await telemetryRepository.findHistory(1, from, to, 2);

    expect(repository.find).toHaveBeenCalledWith({
      where: {
        cluster: { id: 1 },
        created_at: expect.any(Object),
      },
      relations: { cluster: true },
      order: { created_at: 'DESC', id: 'DESC' },
      take: 2,
    });
    expect(result.map((item) => item.id)).toEqual([2, 3]);
  });
});
