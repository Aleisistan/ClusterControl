import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';
import { CameraModule } from './camera/camera.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { ClusterModule } from './cluster/cluster.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({

      type: 'postgres',

      host: 'postgres',

      port: 5432,

      username: 'dcuser',

      password: 'dcpass',

      database: 'datacenter',

      autoLoadEntities: true,

      synchronize: true,

    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelemetryModule,
    CameraModule,
    ClusterModule
  ],

  controllers: [AppController],

  providers: [AppService],

})
export class AppModule {}
