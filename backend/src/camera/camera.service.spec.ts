import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import { CameraService } from './camera.service';
import { LoggerService } from '../common/logger/logger.service';
import { CameraRepository } from './repositories/camera.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { CameraStreamService } from './camera-stream.service';

describe('CameraService', () => {
  let service: CameraService;
  let cameraRepository: {
    findByClusterId: jest.Mock;
    findAllByClusterId: jest.Mock;
    findByDeviceId: jest.Mock;
    findByIp: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clusterRepository: { findByDeviceId: jest.Mock };
  let cameraStreamService: {
    getLatestFrame: jest.Mock;
    isStreaming: jest.Mock;
  };

  beforeEach(async () => {
    cameraRepository = {
      findByClusterId: jest.fn().mockResolvedValue({
        id: 5,
        ip: 'http://192.168.1.50/camera',
      }),
      findAllByClusterId: jest.fn().mockResolvedValue([]),
      findByDeviceId: jest.fn(),
      findByIp: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    clusterRepository = {
      findByDeviceId: jest.fn(),
    };
    cameraStreamService = {
      getLatestFrame: jest.fn().mockResolvedValue(null),
      isStreaming: jest.fn().mockReturnValue(false),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CameraService,
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn() },
        },
        { provide: CameraRepository, useValue: cameraRepository },
        { provide: ClusterRepository, useValue: clusterRepository },
        { provide: CameraStreamService, useValue: cameraStreamService },
      ],
    }).compile();

    service = module.get<CameraService>(CameraService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a camera for a cluster without a configured camera', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    const camera = {
      id: 12,
      name: 'Entrada',
      ip: '192.168.1.50',
      cluster,
    };
    clusterRepository.findByDeviceId.mockResolvedValue(cluster);
    cameraRepository.findByIp.mockResolvedValue(null);
    cameraRepository.create.mockReturnValue(camera);
    cameraRepository.save.mockResolvedValue(camera);

    await expect(
      service.create({
        name: 'Entrada',
        ip: '192.168.1.50',
        deviceId: '7',
      }),
    ).resolves.toEqual(camera);
    expect(cameraRepository.findAllByClusterId).toHaveBeenCalledWith(7);
    expect(cameraRepository.save).toHaveBeenCalledWith(camera);
  });

  it('allows a second camera but rejects a third camera for the same cluster', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    clusterRepository.findByDeviceId.mockResolvedValue(cluster);
    cameraRepository.findAllByClusterId
      .mockResolvedValueOnce([{ id: 11 }])
      .mockResolvedValueOnce([{ id: 11 }, { id: 12 }]);
    cameraRepository.findByIp.mockResolvedValue(null);
    cameraRepository.create.mockReturnValue({ id: 12 });
    cameraRepository.save.mockResolvedValue({ id: 12 });

    await expect(
      service.create({
        name: 'Salida',
        ip: '192.168.1.52',
        deviceId: '7',
      }),
    ).resolves.toEqual({ id: 12 });

    await expect(
      service.create({
        name: 'Techo',
        ip: '192.168.1.53',
        deviceId: '7',
      }),
    ).rejects.toThrow('máximo de 2 cámaras');
  });

  it('captures a JPEG from the configured camera for its cluster', async () => {
    const imageData = Uint8Array.from([1, 2, 3]).buffer;
    const response: AxiosResponse<ArrayBuffer> = {
      data: imageData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    const request = jest.spyOn(axios, 'get').mockResolvedValue(response);

    await expect(service.captureForCluster(7)).resolves.toEqual(
      Buffer.from(imageData),
    );
    expect(request).toHaveBeenCalledWith(
      'http://192.168.1.50:81/capture',
      { responseType: 'arraybuffer', timeout: 10000 },
    );

    request.mockRestore();
  });

  it('uses the latest frame from the shared stream when available', async () => {
    const frame = Buffer.from([0xff, 0xd8, 0x01, 0xff, 0xd9]);
    cameraStreamService.isStreaming.mockReturnValue(true);
    cameraStreamService.getLatestFrame.mockResolvedValue(frame);
    const request = jest.spyOn(axios, 'get');

    await expect(service.captureForCluster(7)).resolves.toEqual(frame);
    expect(cameraStreamService.getLatestFrame).toHaveBeenCalledWith(
      5,
      'http://192.168.1.50:81/stream',
    );
    expect(request).not.toHaveBeenCalled();

    request.mockRestore();
  });

  it('does not open a second capture connection when the active stream times out', async () => {
    cameraStreamService.isStreaming.mockReturnValue(true);
    const request = jest.spyOn(axios, 'get');

    await expect(service.captureForCluster(7)).rejects.toThrow(
      'no entregó un fotograma a tiempo',
    );
    expect(request).not.toHaveBeenCalled();

    request.mockRestore();
  });
});
