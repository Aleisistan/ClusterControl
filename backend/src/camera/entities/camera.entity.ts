import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { Cluster } from '../../cluster/entities/cluster.entity';

@Entity('cameras')
@Index('UQ_camera_cluster_slot', ['cluster', 'slot'], { unique: true })
export class Camera {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  ip: string;

  @Column({ type: 'smallint' })
  slot: number;

  @Column({ default: true })
  status: boolean;

  @Column({ nullable: true })
  snapshotUrl: string;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastSeen: Date;

  @ManyToOne(() => Cluster, (cluster) => cluster.cameras, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  cluster: Cluster;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
