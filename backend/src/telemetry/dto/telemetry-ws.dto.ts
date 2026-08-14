export class TelemetryWsDto {
  id: number;

  clusterId: number;
  deviceId: number;

  temperature1: number;
  temperature2: number;

  humidity1: number;
  humidity2: number;

  extractor: boolean;
  aire: boolean;
  puerta: boolean;

  createdAt: Date;
}