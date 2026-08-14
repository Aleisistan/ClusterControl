import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Cluster } from '../../cluster/entities/cluster.entity';

@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  ip: string;

  @Column({ default: true })
  status: boolean;

  @Column({ nullable: true })
  snapshotUrl: string;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastSeen: Date;

  @OneToOne(() => Cluster, (cluster) => cluster.camera, {
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
