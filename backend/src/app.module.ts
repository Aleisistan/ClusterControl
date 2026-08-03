import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { CameraModule } from './camera/camera.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { ClusterModule } from './cluster/cluster.module';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,

}),
    TelemetryModule,
    CameraModule,
    ClusterModule,
    UsersModule,
    AuthModule,
  ],

  controllers: [AppController],

  providers: [AppService]
  
})
export class AppModule {}
