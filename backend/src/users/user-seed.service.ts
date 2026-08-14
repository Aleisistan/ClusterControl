import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';

@Injectable()
export class UserSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const cantidad = await this.userRepository.count();

    if (cantidad > 0) {
      console.log('Usuarios existentes. No se crea el administrador.');
      return;
    }

    const password = await bcrypt.hash('admin123', 10);

    const admin = this.userRepository.create({
      username: 'admin',
      password,
      role: 'ADMIN',
    });

    await this.userRepository.save(admin);

    console.log('Usuario administrador creado.');
  }
}
