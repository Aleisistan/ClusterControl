export class TelemetryResponseDto {
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

  constructor(data: any) {
    this.id = data.id;

    this.clusterId = data.cluster?.id;
    this.deviceId = data.device?.id;

    this.temperature1 = data.temperature1;
    this.temperature2 = data.temperature2;

    this.humidity1 = data.humidity1;
    this.humidity2 = data.humidity2;

    this.extractor = data.extractor;
    this.aire = data.aire;
    this.puerta = data.puerta;

    this.createdAt = data.created_at;
  }
}
