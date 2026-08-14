import { ConfigService } from '@nestjs/config';

export const jwtConfig = (config: ConfigService) => ({
  secret: config.get<string>('JWT_SECRET'),
  expires: config.get<string>('JWT_EXPIRES'),
});
