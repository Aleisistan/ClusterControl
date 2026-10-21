import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cluster } from '../cluster/entities/cluster.entity';

@Entity('door_snapshots')
@Index('idx_door_snapshots_cluster_created_at', ['cluster', 'createdAt'])
export class DoorSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telemetryId: number;

  @Column({ type: 'bytea' })
  image: Buffer;

  @ManyToOne(() => Cluster, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
