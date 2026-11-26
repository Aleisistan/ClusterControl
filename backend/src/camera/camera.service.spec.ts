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
    findByClusterSlot: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clusterRepository: { findByDeviceId: jest.Mock };
  let cameraStreamService: {
    captureFrame: jest.Mock;
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
      findByClusterSlot: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
    };
    clusterRepository = {
      findByDeviceId: jest.fn(),
    };
    cameraStreamService = {
      captureFrame: jest.fn().mockResolvedValue(Buffer.from('jpeg')),
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

  it('returns the configured camera address without adding a stream path', async () => {
    await expect(service.getStreamUrl(7)).resolves.toBe(
      'http://192.168.1.50/camera',
    );
  });

  it('creates a camera for a cluster without a configured camera', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    const camera = {
      id: 12,
      name: 'Entrada',
      ip: '192.168.1.50',
      slot: 1,
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
        slot: 1,
        deviceId: '7',
      }),
    ).resolves.toEqual(camera);
    expect(cameraRepository.findAllByClusterId).toHaveBeenCalledWith(7);
    expect(cameraRepository.save).toHaveBeenCalledWith(camera);
  });

  it('creates camera 1 when an MQTT announcement arrives and only camera 2 exists', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    const camera2 = {
      id: 12,
      name: 'Salida',
      ip: '192.168.1.52',
      slot: 2,
      cluster,
    };
    clusterRepository.findByDeviceId.mockResolvedValue(cluster);
    cameraRepository.findAllByClusterId.mockResolvedValue([camera2]);
    cameraRepository.findByIp.mockResolvedValue(null);
    cameraRepository.create.mockImplementation((camera) => camera);
    cameraRepository.save.mockImplementation(async (camera) => camera);

    await service.updateFromMqtt({
      deviceId: '7',
      ip: '192.168.1.51',
    });

    expect(cameraRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Cámara 1',
        ip: '192.168.1.51',
        slot: 1,
        cluster,
      }),
    );
    expect(cameraRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ slot: 1, ip: '192.168.1.51' }),
    );
    expect(camera2).toEqual({
      id: 12,
      name: 'Salida',
      ip: '192.168.1.52',
      slot: 2,
      cluster,
    });
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
        slot: 2,
        deviceId: '7',
      }),
    ).resolves.toEqual({ id: 12 });

    await expect(
      service.create({
        name: 'Techo',
        ip: '192.168.1.53',
        slot: 2,
        deviceId: '7',
      }),
    ).rejects.toThrow('máximo de 2 cámaras');
  });

  it('rejects a second camera assigned to an already occupied slot', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    clusterRepository.findByDeviceId.mockResolvedValue(cluster);
    cameraRepository.findAllByClusterId.mockResolvedValue([
      { id: 11, slot: 1 },
    ]);
    cameraRepository.findByClusterSlot.mockResolvedValue({ id: 11, slot: 1 });
    cameraRepository.findByIp.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Otra cámara',
        ip: '192.168.1.52',
        slot: 1,
        deviceId: '7',
      }),
    ).rejects.toThrow('El slot 1 ya tiene una cámara configurada');
    expect(cameraRepository.save).not.toHaveBeenCalled();
  });

  it('converts a database uniqueness race into a conflict response', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    clusterRepository.findByDeviceId.mockResolvedValue(cluster);
    cameraRepository.findByIp.mockResolvedValue(null);
    cameraRepository.create.mockReturnValue({ id: 12 });
    cameraRepository.save.mockRejectedValue({
      driverError: { code: '23505' },
    });

    await expect(
      service.create({
        name: 'Salida',
        ip: '192.168.1.52',
        slot: 2,
        deviceId: '7',
      }),
    ).rejects.toThrow('La dirección o el slot ya está asignado a otra cámara');
  });

  it('reports the occupied slot when the database rejects its unique index', async () => {
    const cluster = { id: 7, deviceId: '7', name: 'Cluster 7' };
    clusterRepository.findByDeviceId.mockResolvedValue(cluster);
    cameraRepository.findByIp.mockResolvedValue(null);
    cameraRepository.create.mockReturnValue({ id: 12 });
    cameraRepository.save.mockRejectedValue({
      driverError: {
        code: '23505',
        constraint: 'UQ_camera_cluster_slot',
      },
    });

    await expect(
      service.create({
        name: 'Entrada',
        ip: 'http://192.168.2.228:8082/stream',
        slot: 1,
        deviceId: '7',
      }),
    ).rejects.toThrow('El slot 1 ya tiene una cámara configurada');
  });

  it('captures from the exact configured URL without assuming a /capture route', async () => {
    cameraRepository.findAllByClusterId.mockResolvedValue([
      {
        id: 5,
        ip: 'http://192.168.2.228:8081/stream',
      },
    ]);

    await expect(service.captureForCluster(7)).resolves.toEqual(
      Buffer.from('jpeg'),
    );
    expect(cameraStreamService.captureFrame).toHaveBeenCalledWith(
      5,
      'http://192.168.2.228:8081/stream',
    );
  });

  it('tries another configured camera if the first stream cannot be captured', async () => {
    cameraRepository.findAllByClusterId.mockResolvedValue([
      { id: 5, ip: 'http://192.168.2.228:8081/stream' },
      { id: 6, ip: 'http://192.168.2.228:8082/stream' },
    ]);
    cameraStreamService.captureFrame
      .mockRejectedValueOnce(new Error('cámara fuera de línea'))
      .mockResolvedValueOnce(Buffer.from('second-camera-jpeg'));

    await expect(service.captureForCluster(7)).resolves.toEqual(
      Buffer.from('second-camera-jpeg'),
    );
    expect(cameraStreamService.captureFrame).toHaveBeenNthCalledWith(
      1,
      5,
      'http://192.168.2.228:8081/stream',
    );
    expect(cameraStreamService.captureFrame).toHaveBeenNthCalledWith(
      2,
      6,
      'http://192.168.2.228:8082/stream',
    );
  });

  it('preserves the ESP32 capture endpoint for legacy bare-IP cameras', async () => {
    cameraRepository.findAllByClusterId.mockResolvedValue([
      {
        id: 5,
        ip: '192.168.1.50',
      },
    ]);
    cameraStreamService.captureFrame.mockRejectedValue(
      new Error('no hay un stream en la raíz'),
    );
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

  it('rejects capture when the cluster has no configured cameras', async () => {
    cameraRepository.findAllByClusterId.mockResolvedValue([]);

    await expect(service.captureForCluster(7)).rejects.toThrow(
      'No existe cámara para el cluster 7',
    );
  });

  it('captures from the exact configured URL without assuming a /capture route', async () => {
    cameraRepository.findAllByClusterId.mockResolvedValue([
      {
      id: 5,
      ip: 'http://192.168.2.228:8081/stream',
      },
    ]);

    await expect(service.captureForCluster(7)).resolves.toEqual(
      Buffer.from('jpeg'),
    );
    expect(cameraStreamService.captureFrame).toHaveBeenCalledWith(
      5,
      'http://192.168.2.228:8081/stream',
    );
  });
});
