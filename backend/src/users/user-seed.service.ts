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
    if (process.env.SEED_DEFAULT_USER !== 'true') {
      console.log('Seed del usuario inicial deshabilitado.');
      return;
    }

    const cantidad = await this.userRepository.count();

    if (cantidad > 0) {
      console.log('Usuarios existentes. No se crea el administrador.');
      return;
    }

    const username = process.env.INITIAL_ADMIN_USERNAME;
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!username || !initialPassword) {
      throw new Error(
        'INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD son obligatorios para crear el usuario inicial.',
      );
    }

    const password = await bcrypt.hash(initialPassword, 10);
    const admin = this.userRepository.create({
      username,
      password,
      role: 'ADMIN',
    });

    await this.userRepository.save(admin);

    console.log('Usuario administrador creado.');
  }
}
