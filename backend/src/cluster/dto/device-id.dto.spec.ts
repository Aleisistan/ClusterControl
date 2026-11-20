import { validate } from 'class-validator';
import { CreateClusterDto } from './create-cluster.dto';
import { UpdateClusterDto } from './update-cluster.dto';

describe('Cluster deviceId validation', () => {
  it.each([
    ['create', CreateClusterDto, { name: 'Cluster', deviceId: '34' }],
    ['update', UpdateClusterDto, { deviceId: '34' }],
  ])('accepts a numeric deviceId on %s', async (_operation, Dto, data) => {
    const errors = await validate(Object.assign(new Dto(), data));

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['create', CreateClusterDto, { name: 'Cluster', deviceId: 'cluster-34' }],
    ['update', UpdateClusterDto, { deviceId: 'cluster-34' }],
  ])('rejects a non-numeric deviceId on %s', async (_operation, Dto, data) => {
    const errors = await validate(Object.assign(new Dto(), data));

    expect(errors.some((error) => error.property === 'deviceId')).toBe(true);
  });
});
