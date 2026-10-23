import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Cluster } from '../cluster/entities/cluster.entity';

@Entity()
@Index('idx_telemetry_cluster_created_at', ['cluster', 'created_at'])
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

  @Column()
  luzEncendida: boolean;

  @Column({ type: 'varchar', length: 32, default: 'device' })
  source: 'device' | 'simulator' | 'industrial-test';

  @ManyToOne(() => Cluster, (cluster) => cluster.telemetries, {
    nullable: false,
  })
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster: Cluster;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
