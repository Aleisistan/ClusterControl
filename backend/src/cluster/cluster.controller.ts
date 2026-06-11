import { Controller, Get, Param } from '@nestjs/common';

import { ClusterService } from './cluster.service';

@Controller('clusters')
export class ClusterController {

  constructor(
    private readonly clusterService: ClusterService
  ) {}

  @Get()
  findAll() {
    return this.clusterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.clusterService.findOne(id);
  }
}
