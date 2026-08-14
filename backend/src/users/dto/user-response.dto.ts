import { User } from '../entities/user.entity';

export class UserResponseDto {
  id: number;
  username: string;
  role: string;
  createdAt: Date;

  constructor(user: User) {
    this.id = user.id;
    this.username = user.username;
    this.role = user.role;
    this.createdAt = user.createdAt;
  }
}
