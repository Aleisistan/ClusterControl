import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {

    const user = await this.usersService.findByUsername(loginDto.username);

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const passwordOk = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordOk) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {

      access_token: this.jwtService.sign(payload),

      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },

    };
  }
}