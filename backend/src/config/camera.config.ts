import { ConfigService } from '@nestjs/config';

export const cameraConfig = (config: ConfigService) => ({
  url: config.get<string>('CAMERA_URL'),
});
