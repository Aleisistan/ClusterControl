import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cluster } from '../cluster/entities/cluster.entity';

@Entity('alert_configurations')
export class AlertConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Cluster, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster;

  @Column('float', { default: 30 })
  temperatureLimit: number;

  @Column('float', { default: 80 })
  humidityLimit: number;

  @Column('text', { array: true, default: '{}' })
  recipients: string[];
}
