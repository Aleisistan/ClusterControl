import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cluster } from '../cluster/entities/cluster.entity';

@Entity()
export class Telemetry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('float')
  temperature1: number;

  @Column('float')
  temperature2: number;

  @Column('float')
  humidity1: number;

  @Column('float')
  humidity2: number;

  @Column()
  extractor: boolean;

  @Column()
  aire: boolean;

  @Column()
  puerta: boolean;

  @ManyToOne(() => Cluster, (cluster) => cluster.telemetries, {
    nullable: false,
  })
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster: Cluster;

  @CreateDateColumn()
  created_at: Date;
}
