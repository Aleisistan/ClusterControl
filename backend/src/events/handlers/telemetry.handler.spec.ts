import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../common/logger/logger.service';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { TelemetryHandler } from './telemetry.handler';

describe('TelemetryHandler', () => {
  const telemetryService = {
    saveTelemetry: jest.fn().mockResolvedValue(undefined),
  };
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
  };
  let handler: TelemetryHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryHandler,
        { provide: TelemetryService, useValue: telemetryService },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();

    handler = module.get<TelemetryHandler>(TelemetryHandler);
  });

  it('accepts a numeric deviceId used by firmware telemetry', async () => {
    await handler.handle({
      deviceId: 34,
      temp1: 25,
      temp2: 26,
      hum1: 50,
      hum2: 51,
      extractor: false,
      aire: false,
      puerta: false,
      luzEncendida: false,
    });

    expect(telemetryService.saveTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 34 }),
    );
  });

  it('rejects a string deviceId rather than silently dropping firmware telemetry', async () => {
    await handler.handle({
      deviceId: '34',
      temp1: 25,
      temp2: 26,
      hum1: 50,
      hum2: 51,
      extractor: false,
      aire: false,
      puerta: false,
      luzEncendida: false,
    });

    expect(telemetryService.saveTelemetry).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Payload de telemetría inválido'),
    );
  });
});
