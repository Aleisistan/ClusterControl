import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();
    return users.map((user) => new UserResponseDto(user));
  }

  async findById(id: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return new UserResponseDto(user);
  }
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }
  async create(user: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findByUsername(
      user.username,
    );

    if (existingUser) {
      throw new ConflictException('No se puede crear el usuario');
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);

    const newUser = this.userRepository.create({
      ...user,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);

    return new UserResponseDto(savedUser);
  }
  async update(
    id: number,
    data: UpdateUserDto,
  ): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (data.username !== undefined) {
      const existingUser = await this.userRepository.findByUsername(
        data.username,
      );

      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictException('No se puede actualizar el usuario');
      }

      user.username = data.username;
    }
    if (data.role !== undefined) {
      user.role = data.role;
    }

    if (data.password !== undefined) {
      user.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.userRepository.save(user);

    return new UserResponseDto(updatedUser);
  }
  async delete(id: number): Promise<void> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.userRepository.delete(id);
  }
}
