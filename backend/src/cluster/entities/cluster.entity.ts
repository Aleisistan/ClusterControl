import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';

import { Telemetry } from '../../telemetry/telemetry.entity';

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

  @Column({ nullable: true })
  timezone: string;
  
  @OneToMany(
    () => Telemetry,
    telemetry => telemetry.cluster
  )
  telemetries: Telemetry[];
}