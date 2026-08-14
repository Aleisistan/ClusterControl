import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
} from 'typeorm';

import { Telemetry } from '../../telemetry/telemetry.entity';
import { Camera } from '../../camera/entities/camera.entity';

@Entity('clusters')
export class Cluster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column('float', { nullable: true })
  lat: number;

  @Column('float', { nullable: true })
  lon: number;

  @Column({
    nullable: true,
    unique: true,
  })
  deviceId: string;

  @Column({ nullable: true })
  timezone: string;

  @OneToOne(() => Camera, (camera) => camera.cluster)
  camera: Camera;

  @OneToMany(() => Telemetry, (telemetry) => telemetry.cluster)
  telemetries: Telemetry[];
}
