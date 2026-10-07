import { Repository } from 'typeorm';
import { Telemetry } from '../telemetry.entity';
import { TelemetryRepository } from './telemetry.repository';

describe('TelemetryRepository', () => {
  it('returns representative samples across the whole requested range', async () => {
    const chronological = [
      { id: 2, created_at: new Date('2026-10-05T12:00:02Z') },
      { id: 3, created_at: new Date('2026-10-06T12:00:03Z') },
    ] as Telemetry[];
    const repository = {
      query: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]),
      find: jest.fn().mockResolvedValue(chronological),
    } as unknown as Repository<Telemetry>;
    const telemetryRepository = new TelemetryRepository(repository);
    const from = new Date('2026-10-05T12:00:00Z');
    const to = new Date('2026-10-06T12:00:00Z');

    const result = await telemetryRepository.findHistory(1, from, to, 2);

    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('NTILE($4::int)'),
      [1, from, to, 2],
    );
    expect(repository.find).toHaveBeenCalledWith({
      where: { id: expect.anything() },
      relations: { cluster: true },
      order: { created_at: 'ASC', id: 'ASC' },
    });
    expect(result.map((item) => item.created_at)).toEqual([
      chronological[0].created_at,
      chronological[1].created_at,
    ]);
  });

  it('detects telemetry gaps exceeding the expected reporting interval', async () => {
    const outage = {
      id: 'outage-2-3',
      eventType: 'disconnect',
      createdAt: new Date('2026-10-06T12:01:00Z'),
      startedAt: new Date('2026-10-06T12:00:45Z'),
      endedAt: new Date('2026-10-06T12:01:00Z'),
    };
    const repository = {
      query: jest.fn().mockResolvedValue([outage]),
    } as unknown as Repository<Telemetry>;
    const telemetryRepository = new TelemetryRepository(repository);
    const from = new Date('2026-10-06T12:00:00Z');
    const to = new Date('2026-10-06T12:02:00Z');

    await expect(
      telemetryRepository.findOutages(1, from, to, 10),
    ).resolves.toEqual([outage]);

    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining("created_at - previous_created_at > INTERVAL '30 seconds'"),
      [1, from, to, 10],
    );
  });
});
