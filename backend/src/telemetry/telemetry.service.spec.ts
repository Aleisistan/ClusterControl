import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { TelemetryGateway } from './telemetry.gateway';
import { LoggerService } from '../common/logger/logger.service';
import { CameraService } from '../camera/camera.service';
import { DoorSnapshotRepository } from './repositories/door-snapshot.repository';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let telemetryRepository: {
    create: jest.Mock;
    findLatest: jest.Mock;
    save: jest.Mock;
    findStateChanges: jest.Mock;
    findOutages: jest.Mock;
    deleteOlderThan: jest.Mock;
  };
  let cameraService: { captureForCluster: jest.Mock };
  let doorSnapshotRepository: {
    findHistory: jest.Mock;
    findImage: jest.Mock;
    save: jest.Mock;
  };
  let telemetryGateway: {
    sendTelemetry: jest.Mock;
    sendDoorSnapshot: jest.Mock;
  };
  let clusterRepository: { findByDeviceId: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    telemetryRepository = {
      create: jest.fn((data) => ({ id: 24, ...data })),
      findLatest: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (telemetry) => telemetry),
      findStateChanges: jest.fn().mockResolvedValue([]),
      findOutages: jest.fn().mockResolvedValue([]),
      deleteOlderThan: jest.fn().mockResolvedValue(0),
    };
    cameraService = {
      captureForCluster: jest.fn().mockResolvedValue(Buffer.from('jpeg')),
    };
    doorSnapshotRepository = {
      findHistory: jest.fn().mockResolvedValue([]),
      findImage: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({
        id: 9,
        createdAt: new Date('2026-10-06T12:00:01.000Z'),
      }),
    };
    telemetryGateway = {
      sendTelemetry: jest.fn(),
      sendDoorSnapshot: jest.fn(),
    };
    clusterRepository = {
      findByDeviceId: jest.fn().mockResolvedValue({ id: 12 }),
    };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: TelemetryRepository, useValue: telemetryRepository },
        { provide: ClusterRepository, useValue: clusterRepository },
        { provide: TelemetryGateway, useValue: telemetryGateway },
        { provide: LoggerService, useValue: logger },
        { provide: CameraService, useValue: cameraService },
        { provide: DoorSnapshotRepository, useValue: doorSnapshotRepository },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('captures and stores an image when the door changes from closed to open', async () => {
    telemetryRepository.findLatest.mockResolvedValue({ puerta: false });

    await service.saveTelemetry({
      deviceId: 12,
      temp1: 20,
      temp2: 21,
      hum1: 40,
      hum2: 41,
      extractor: false,
      aire: false,
      puerta: true,
      luzEncendida: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cameraService.captureForCluster).toHaveBeenCalledWith(12);
    expect(doorSnapshotRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetryId: 24,
        image: Buffer.from('jpeg'),
        cluster: { id: 12 },
      }),
    );
    expect(telemetryGateway.sendDoorSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ clusterId: 12, snapshotId: 9 }),
    );
  });

  it('does not capture an image unless the door transitions to open', async () => {
    telemetryRepository.findLatest.mockResolvedValue({ puerta: true });

    await service.saveTelemetry({
      deviceId: 12,
      temp1: 20,
      temp2: 21,
      hum1: 40,
      hum2: 41,
      extractor: false,
      aire: false,
      puerta: true,
      luzEncendida: false,
    });

    expect(cameraService.captureForCluster).not.toHaveBeenCalled();
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
    ).resolves.toEqual(rows);

    expect(telemetryRepository.findStateChanges).toHaveBeenCalledWith(
      12,
      from,
      to,
      25,
    );
    expect(telemetryRepository.findOutages).toHaveBeenCalledWith(
      12,
      from,
      to,
      25,
    );
    expect(doorSnapshotRepository.findHistory).toHaveBeenCalledWith(
      12,
      from,
      to,
      25,
    );
  });

  it('includes recovered outages in chronological history order', async () => {
    const stateChange = {
      id: 5,
      createdAt: new Date('2026-10-06T12:01:00.000Z'),
    };
    const outage = {
      id: 'outage-3-4',
      eventType: 'disconnect',
      createdAt: new Date('2026-10-06T12:00:30.000Z'),
      startedAt: new Date('2026-10-06T12:00:15.000Z'),
      endedAt: new Date('2026-10-06T12:00:30.000Z'),
    };
    telemetryRepository.findStateChanges.mockResolvedValue([stateChange]);
    telemetryRepository.findOutages.mockResolvedValue([outage]);

    await expect(
      service.getStateHistory(12, '2026-10-06T12:00:00.000Z', '2026-10-06T12:02:00.000Z'),
    ).resolves.toEqual([stateChange, outage]);
  });

  it('includes saved door snapshots in the state history', async () => {
    const createdAt = new Date();
    const snapshot = {
      id: 9,
      telemetryId: 24,
      createdAt,
    };
    doorSnapshotRepository.findHistory.mockResolvedValue([snapshot]);

    await expect(service.getStateHistory(12)).resolves.toContainEqual({
      id: 'door-snapshot-9',
      eventType: 'door-snapshot',
      snapshotId: 9,
      telemetryId: 24,
      createdAt,
    });
  });

  it('returns the stored image for a door snapshot', async () => {
    const image = Buffer.from('jpeg');
    doorSnapshotRepository.findImage.mockResolvedValue(image);

    await expect(service.getDoorSnapshotImage(9)).resolves.toEqual(image);
  });

  it('rejects invalid state-history date ranges', async () => {
    await expect(
      service.getStateHistory(12, '2026-10-06T13:00:00.000Z', '2026-10-06T12:00:00.000Z'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
