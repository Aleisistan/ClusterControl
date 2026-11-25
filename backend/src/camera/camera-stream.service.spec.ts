import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';

import { LoggerService } from '../common/logger/logger.service';
import { CameraStreamService } from './camera-stream.service';

jest.mock('axios');
jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

describe('CameraStreamService', () => {
  let service: CameraStreamService;
  let upstream: PassThrough;

  beforeEach(() => {
    upstream = new PassThrough();
    const logger = {
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as LoggerService;
    service = new CameraStreamService(logger);
    jest.mocked(axios).mockReset();
    jest.mocked(spawn).mockReset();
    jest.mocked(axios).mockResolvedValue({
      data: upstream,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'multipart/x-mixed-replace; boundary=camera-boundary' },
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse<PassThrough>);
  });

  it('shares one camera connection with multiple viewers', async () => {
    const firstClient = createResponse();
    const firstFrames: Buffer[] = [];
    firstClient.on('data', (frame: Buffer) => firstFrames.push(frame));

    await service.stream(1, 'http://camera/stream', firstClient);

    expect(axios).toHaveBeenCalledTimes(1);
    expect(firstClient.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'multipart/x-mixed-replace; boundary=camera-boundary',
    );

    const secondClient = createResponse();
    const secondFrames: Buffer[] = [];
    secondClient.on('data', (frame: Buffer) => secondFrames.push(frame));
    await service.stream(1, 'http://camera/stream', secondClient);

    expect(axios).toHaveBeenCalledTimes(1);
    expect(secondClient.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'multipart/x-mixed-replace; boundary=camera-boundary',
    );

    upstream.write(Buffer.from('frame 1'));
    expect(Buffer.concat(firstFrames).toString()).toBe('frame 1');
    expect(Buffer.concat(secondFrames).toString()).toBe('frame 1');

    firstClient.destroy();
    upstream.write(Buffer.from('frame 2'));
    expect(Buffer.concat(firstFrames).toString()).toBe('frame 1');
    expect(Buffer.concat(secondFrames).toString()).toBe('frame 1frame 2');

    secondClient.destroy();
    upstream.destroy();
  });

  it('extracts a JPEG frame when its markers arrive in separate chunks', async () => {
    await service.stream(1, 'http://camera/stream', createResponse());
    upstream.write(Buffer.from([0x2d, 0xff, 0xd8, 0x01, 0x02]));
    upstream.write(Buffer.from([0x03, 0xff, 0xd9, 0x2d]));

    await expect(
      service.getLatestFrame(1, 'http://camera/stream'),
    ).resolves.toEqual(Buffer.from([0xff, 0xd8, 0x01, 0x02, 0x03, 0xff, 0xd9]));

    upstream.destroy();
  });

  it('waits for a complete JPEG when the stream has not produced a frame yet', async () => {
    await service.stream(1, 'http://camera/stream', createResponse());
    const pendingFrame = service.getLatestFrame(1, 'http://camera/stream');
    upstream.write(Buffer.from([0xff, 0xd8, 0x04, 0xff, 0xd9]));

    await expect(pendingFrame).resolves.toEqual(
      Buffer.from([0xff, 0xd8, 0x04, 0xff, 0xd9]),
    );

    upstream.destroy();
  });

  it('captures a JPEG from a configured HTTP stream when no viewer is connected', async () => {
    const process = createFfmpegProcess();
    jest.mocked(spawn).mockReturnValue(process);
    const streamUrl = 'http://camera.example:8081/live/stream.m3u8';
    const capture = service.captureFrame(1, streamUrl);
    const frame = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
    process.stdout.write(frame);
    process.emit('close', 0, null);

    await expect(capture).resolves.toEqual(frame);
    expect(spawn).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining([
        '-protocol_whitelist',
        'http,https,tcp,tls,crypto',
        streamUrl,
        '-frames:v',
        '1',
      ]),
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  });

  it('reuses a frame from an active stream instead of opening a second connection', async () => {
    const response = createResponse();
    await service.stream(1, 'http://camera/stream', response);
    const frame = Buffer.from([0xff, 0xd8, 0x01, 0xff, 0xd9]);
    upstream.write(frame);

    await expect(
      service.captureFrame(1, 'http://camera/stream'),
    ).resolves.toEqual(frame);
    expect(spawn).not.toHaveBeenCalled();

    response.destroy();
    upstream.destroy();
  });

  it('rejects invalid URLs without starting FFmpeg', async () => {
    await expect(
      service.captureFrame(1, 'file:///etc/passwd'),
    ).rejects.toThrow('solo admite URLs HTTP o HTTPS');
    expect(spawn).not.toHaveBeenCalled();
  });
});

function createFfmpegProcess(): EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: jest.Mock;
} {
  const process = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: jest.Mock;
  };
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.kill = jest.fn();
  return process;
}

function createResponse(): Response {
  const response = new PassThrough() as PassThrough & {
    setHeader: jest.Mock;
  };
  response.setHeader = jest.fn();
  return response as unknown as Response;
}
