import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';

import { LoggerService } from '../common/logger/logger.service';
import { CameraStreamService } from './camera-stream.service';

jest.mock('axios');

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
});

function createResponse(): Response {
  const response = new PassThrough() as PassThrough & {
    setHeader: jest.Mock;
  };
  response.setHeader = jest.fn();
  return response as unknown as Response;
}
