import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ClusterService } from './cluster.service';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('clusters')
@UseGuards(JwtAuthGuard)
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Get()
  findAll() {
    return this.clusterService.findAll();
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClusterDto: UpdateClusterDto,
  ) {
    return this.clusterService.update(id, updateClusterDto);
  }
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clusterService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() data: CreateClusterDto) {
    return this.clusterService.create(data);
  }
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.clusterService.delete(id);
  }
}
