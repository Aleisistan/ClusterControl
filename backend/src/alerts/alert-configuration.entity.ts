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

  @Column('float', { default: 27 })
  temperatureRecoveryLimit: number;

  @Column('float', { default: 70 })
  humidityRecoveryLimit: number;

  @Column({ default: true })
  temperatureEnabled: boolean;

  @Column({ default: true })
  humidityEnabled: boolean;

  @Column({ default: false })
  temperature1Active: boolean;

  @Column({ default: false })
  temperature2Active: boolean;

  @Column({ default: false })
  humidity1Active: boolean;

  @Column({ default: false })
  humidity2Active: boolean;

  @Column({ default: false })
  temperatureActive: boolean;

  @Column({ default: false })
  humidityActive: boolean;

  @Column('text', { array: true, default: '{}' })
  recipients: string[];
}
