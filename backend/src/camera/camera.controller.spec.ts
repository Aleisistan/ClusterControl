import { Test, TestingModule } from '@nestjs/testing';
import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';
import { CameraStreamService } from './camera-stream.service';
import { LoggerService } from '../common/logger/logger.service';
import type { Response } from 'express';
import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import { PassThrough } from 'node:stream';

describe('CameraController', () => {
  let controller: CameraController;
  let cameraService: { findAll: jest.Mock };
  let cameraStreamService: { stream: jest.Mock };

  beforeEach(async () => {
    cameraService = { findAll: jest.fn() };
    cameraStreamService = { stream: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CameraController],
      providers: [
        {
          provide: CameraService,
          useValue: cameraService,
        },
        {
          provide: CameraStreamService,
          useValue: cameraStreamService,
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<CameraController>(CameraController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('redirects a configured full stream URL instead of treating its hostname as an IP', async () => {
    const streamUrl =
      'https://hoktastream3.webcamera.pl/krakow_cam_6f3258/krakow_cam_6f3258.stream/playlist.m3u8';
    cameraService.findAll.mockResolvedValue([
      { id: 1, ip: streamUrl, cluster: { id: 3 } },
    ]);
    const response = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      headersSent: false,
    } as unknown as Response;

    await controller.stream(3, undefined, undefined, undefined, response);

    expect(response.redirect).toHaveBeenCalledWith(streamUrl);
    expect(cameraStreamService.stream).not.toHaveBeenCalled();
  });

  it('returns a clear validation response for a legacy hostname-only address', async () => {
    cameraService.findAll.mockResolvedValue([
      { id: 1, ip: 'hoktastream3.webcamera.pl', cluster: { id: 3 } },
    ]);
    const response = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      headersSent: false,
    } as unknown as Response;

    await controller.stream(3, undefined, undefined, undefined, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining('URL completa'),
    );
    expect(cameraStreamService.stream).not.toHaveBeenCalled();
  });

  it('keeps IP-based ESP32 streams on the shared relay', async () => {
    cameraService.findAll.mockResolvedValue([
      { id: 1, ip: '192.168.1.50', cluster: { id: 3 } },
    ]);
    const response = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      headersSent: false,
      setHeader: jest.fn(),
      on: jest.fn(),
    } as unknown as Response;

    await controller.stream(3, undefined, undefined, undefined, response);

    expect(cameraStreamService.stream).toHaveBeenCalledWith(
      1,
      'http://192.168.1.50:81/stream',
      response,
    );
    expect(response.redirect).not.toHaveBeenCalled();
  });

  it('selects the requested camera when a cluster has two cameras', async () => {
    cameraService.findAll.mockResolvedValue([
      { id: 1, ip: '192.168.1.50', cluster: { id: 3 } },
      { id: 2, ip: '192.168.1.51', cluster: { id: 3 } },
    ]);
    const response = createResponse();

    await controller.stream(3, '2', undefined, undefined, response);

    expect(cameraStreamService.stream).toHaveBeenCalledWith(
      2,
      'http://192.168.1.51:81/stream',
      response,
    );
  });

  it('relays a full IP camera URL with its configured port and path', async () => {
    const streamUrl = 'http://192.168.1.50:8080/cam/live?channel=2';
    cameraService.findAll.mockResolvedValue([
      { id: 1, ip: streamUrl, cluster: { id: 3 } },
    ]);
    const response = createResponse();

    await controller.stream(3, undefined, undefined, undefined, response);

    expect(cameraStreamService.stream).toHaveBeenCalledWith(
      1,
      streamUrl,
      response,
    );
    expect(response.redirect).not.toHaveBeenCalled();
  });

  it('proxies an IP-hosted HLS playlist and rewrites its resource URLs through the API', async () => {
    const streamUrl = 'http://192.168.1.50:8080/live/master.m3u8';
    cameraService.findAll.mockResolvedValue([
      { id: 1, ip: streamUrl, cluster: { id: 3 } },
    ]);
    const playlist = Buffer.from(
      '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nvariant/index.m3u8\n',
    );
    const request = jest.spyOn(axios, 'get').mockResolvedValue({
      data: playlist.buffer.slice(
        playlist.byteOffset,
        playlist.byteOffset + playlist.byteLength,
      ) as ArrayBuffer,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      status: 200,
      statusText: 'OK',
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse<ArrayBuffer>);
    const response = createResponse();

    await controller.stream(3, '1', undefined, 'test-jwt', response);

    const rewrittenPlaylist = response.send.mock.calls[0][0] as string;
    expect(rewrittenPlaylist).toContain(
      '?cameraId=1&resource=http%3A%2F%2F192.168.1.50%3A8080%2Flive%2Fkey.bin&token=test-jwt',
    );
    expect(rewrittenPlaylist).toContain(
      '?cameraId=1&resource=http%3A%2F%2F192.168.1.50%3A8080%2Flive%2Fvariant%2Findex.m3u8&token=test-jwt',
    );
    expect(request).toHaveBeenCalledWith(
      streamUrl,
      expect.objectContaining({ responseType: 'arraybuffer', maxRedirects: 0 }),
    );
  });

  it('rejects HLS resources from a different origin', async () => {
    cameraService.findAll.mockResolvedValue([
      {
        id: 1,
        ip: 'http://192.168.1.50:8080/live/master.m3u8',
        cluster: { id: 3 },
      },
    ]);
    const response = createResponse();
    const request = jest.spyOn(axios, 'get');

    await controller.stream(
      3,
      undefined,
      'https://example.com/segment.ts',
      'test-jwt',
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(
      'El recurso HLS debe pertenecer al origen configurado',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('proxies HLS segments from the configured IP origin', async () => {
    cameraService.findAll.mockResolvedValue([
      {
        id: 1,
        ip: 'http://192.168.1.50:8080/live/master.m3u8',
        cluster: { id: 3 },
      },
    ]);
    const segment = new PassThrough();
    const request = jest.spyOn(axios, 'get').mockResolvedValue({
      data: segment,
      headers: { 'content-type': 'video/mp2t' },
    } as AxiosResponse<PassThrough>);
    const response = createStreamResponse();

    await controller.stream(
      3,
      undefined,
      'http://192.168.1.50:8080/live/part.ts',
      'test-jwt',
      response,
    );

    expect(request).toHaveBeenCalledWith(
      'http://192.168.1.50:8080/live/part.ts',
      expect.objectContaining({ responseType: 'stream', maxRedirects: 0 }),
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp2t');
    const completed = new Promise<void>((resolve) =>
      response.once('finish', resolve),
    );
    segment.end(Buffer.from('segment'));
    await completed;
    expect(response.read()?.toString()).toBe('segment');
  });
});

function createResponse(): Response & {
  redirect: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
} {
  return {
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    setHeader: jest.fn(),
    headersSent: false,
  } as unknown as Response & {
    redirect: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
  };
}

function createStreamResponse(): Response & PassThrough & {
  setHeader: jest.Mock;
} {
  const response = new PassThrough() as PassThrough & {
    setHeader: jest.Mock;
  };
  response.setHeader = jest.fn();
  return response as Response & PassThrough & { setHeader: jest.Mock };
}
