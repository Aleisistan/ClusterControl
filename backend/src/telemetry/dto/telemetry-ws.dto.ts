export class TelemetryWsDto {
  id: number;

  clusterId: number;
  deviceId: string;

  temperature1: number;
  temperature2: number;

  humidity1: number;
  humidity2: number;

  extractor: boolean;
  aire: boolean;
  puerta: boolean;
  luzEncendida: boolean;

  createdAt: Date;
}