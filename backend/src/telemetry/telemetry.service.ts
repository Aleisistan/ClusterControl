import { Injectable, OnModuleInit } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import * as mqtt from 'mqtt';

import { Telemetry } from './telemetry.entity';
import { TelemetryGateway } from './telemetry.gateway';
import { Cluster } from '../cluster/entities/cluster.entity';
import { CameraService } from 'src/camera/camera.service';

@Injectable()
export class TelemetryService implements OnModuleInit {
  constructor(
    @InjectRepository(Telemetry)
    private telemetryRepository: Repository<Telemetry>,
    @InjectRepository(Cluster)
    private clusterRepository: Repository<Cluster>,
    private readonly cameraService: CameraService,
    private telemetryGateway: TelemetryGateway,
    
  ) {}

  onModuleInit() {
    const client = mqtt.connect('mqtt://mosquitto:1883');

    client.on('connect', () => {
      console.log('MQTT conectado');

      client.subscribe('datacenter/ambiente');
      client.subscribe('datacenter/camera/ip');
    });

    client.on('message', async (topic, message) => {
      try {
      
        const data = JSON.parse(message.toString());
      
        if (topic === 'datacenter/camera/ip') {

          this.cameraService.setCameraIp(data.ip);
          return;
}

        await this.saveTelemetry(data);
        } catch (error) {
         console.log(error);
  }
});
}

  async saveTelemetry(data: any) {

    const cluster = await this.clusterRepository.findOne({
      where: {
        id: data.clusterId,
      },
  });

  if (!cluster) {
    throw new Error(`Cluster ${data.clusterId} no encontrado`);
  }

  const telemetry = this.telemetryRepository.create({

    temperature1: data.temp1,

    temperature2: data.temp2,

    humidity1: data.hum1,

    humidity2: data.hum2,

    extractor: data.extractor,

    aire: data.aire,

    puerta: data.puerta,

    cluster,

  });

  await this.telemetryRepository.save(telemetry);

  this.telemetryGateway.sendTelemetry(telemetry);

  console.log("Guardado PostgreSQL");

  return telemetry;
}
  async getLatest(clusterId: number) {
    return this.telemetryRepository.find({
      where: {
      cluster: {
        id: clusterId,
      },
    },
      order: {
        created_at: 'DESC',
      },

      take: 1,
    });
  }

  async getHistory(clusterId: number) {
    return this.telemetryRepository.find({
      where: {
      cluster: {
        id: clusterId,
      },
    },
      order: {
        created_at: 'DESC',
      },

      take: 100,
    });
  }
}
