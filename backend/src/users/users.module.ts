import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';  
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserSeedService } from './user-seed.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UserSeedService],
  exports: [UsersService],
})
export class UsersModule {}
