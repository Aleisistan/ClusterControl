import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const databaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',

  host: config.get<string>('database.host'),

  port: config.get<number>('database.port'),

  username: config.get<string>('database.user'),

  password: config.get<string>('database.password'),

  database: config.get<string>('database.database'),

  autoLoadEntities: true,

  synchronize: true,
});
