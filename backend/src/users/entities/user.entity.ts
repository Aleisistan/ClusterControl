import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  username: string;

  @Column()
  password: string;

  @Column({
    default: 'ADMIN',
  })
  role: string;

  @CreateDateColumn()
  createdAt: Date;
}