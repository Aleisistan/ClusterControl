import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AlertConfiguration } from './alerts/alert-configuration.entity';
import { Camera } from './camera/entities/camera.entity';
import { Cluster } from './cluster/entities/cluster.entity';
import { DoorSnapshot } from './telemetry/door-snapshot.entity';
import { Telemetry } from './telemetry/telemetry.entity';
import { User } from './users/entities/user.entity';

const envFile = resolve(
  process.cwd(),
  '..',
  process.env.NODE_ENV === 'production' ? '.env' : '.env.development.local',
);
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'clustercontrol',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'clustercontrol',
  entities: [
    AlertConfiguration,
    Camera,
    Cluster,
    DoorSnapshot,
    Telemetry,
    User,
  ],
  migrations: [__dirname + '/database/migrations/*{.js,.ts}'],
});
