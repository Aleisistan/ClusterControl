import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  create(data: Partial<User>) {
    return this.repository.create(data);
  }

  async save(user: User) {
    return this.repository.save(user);
  }

  async findAll() {
    return this.repository.find();
  }

  async findById(id: number) {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByUsername(username: string) {
    return this.repository.findOne({
      where: { username },
    });
  }

  async delete(id: number) {
    return this.repository.delete(id);
  }
}
