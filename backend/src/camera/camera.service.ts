import { Injectable } from '@nestjs/common';

@Injectable()
export class CameraService {

  private cameraIp = '';

  setCameraIp(ip: string) {

    this.cameraIp = ip;

    console.log('CAMARA IP ACTUALIZADA:', ip);

  }

  getCameraIp(): string {

    return this.cameraIp;

  }

}
