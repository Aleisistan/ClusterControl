import { Injectable } from '@nestjs/common';
import { EventHandler } from '../event-handler.interface';
import { MQTT_TOPICS } from '../../config/topics';
import { CameraService } from '../../camera/camera.service';
import { CameraPayload } from 'src/camera/dto/camera.payload';

@Injectable()
export class CameraHandler implements EventHandler {
  topic = MQTT_TOPICS.CAMERA_IP;

  constructor(private readonly cameraService: CameraService) {}

  async handle(data: CameraPayload): Promise<void> {
    await this.cameraService.updateFromMqtt(data);
  }
}
