import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { TelemetryGateway } from './telemetry.gateway';
import { LoggerService } from '../common/logger/logger.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let telemetryRepository: {
    findStateChanges: jest.Mock;
    deleteOlderThan: jest.Mock;
  };

  beforeEach(async () => {
    telemetryRepository = {
      findStateChanges: jest.fn().mockResolvedValue([]),
      deleteOlderThan: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: TelemetryRepository, useValue: telemetryRepository },
        { provide: ClusterRepository, useValue: {} },
        { provide: TelemetryGateway, useValue: {} },
        { provide: LoggerService, useValue: { log: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns state changes for the requested cluster and date range', async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    const to = new Date(now.getTime() - 30 * 60 * 1000);
    const rows = [{ id: 5, extractor: true }];
    telemetryRepository.findStateChanges.mockResolvedValue(rows);

    await expect(
      service.getStateHistory(
        12,
        from.toISOString(),
        to.toISOString(),
        '25',
      ),
    ).resolves.toBe(rows);

    expect(telemetryRepository.findStateChanges).toHaveBeenCalledWith(
      12,
      from,
      to,
      25,
    );
  });

  it('rejects invalid state-history date ranges', async () => {
    await expect(
      service.getStateHistory(12, '2026-10-06T13:00:00.000Z', '2026-10-06T12:00:00.000Z'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
