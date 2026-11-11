import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { UserSeedService } from './user-seed.service';

describe('UserSeedService', () => {
  const previousEnvironment = {
    seed: process.env.SEED_DEFAULT_USER,
    username: process.env.INITIAL_ADMIN_USERNAME,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  };
  let userRepository: {
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: UserSeedService;

  beforeEach(async () => {
    userRepository = {
      count: jest.fn(),
      create: jest.fn((user) => user),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSeedService,
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();
    service = module.get(UserSeedService);
  });

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('SEED_DEFAULT_USER', previousEnvironment.seed);
    restore('INITIAL_ADMIN_USERNAME', previousEnvironment.username);
    restore('INITIAL_ADMIN_PASSWORD', previousEnvironment.password);
  });

  it('skips creating the development administrator when seeding is disabled', async () => {
    delete process.env.SEED_DEFAULT_USER;

    await service.onModuleInit();

    expect(userRepository.count).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('uses the configured initial administrator credentials', async () => {
    process.env.SEED_DEFAULT_USER = 'true';
    process.env.INITIAL_ADMIN_USERNAME = 'deploy-admin';
    process.env.INITIAL_ADMIN_PASSWORD = 'configured-password';
    userRepository.count.mockResolvedValue(0);
    userRepository.save.mockImplementation(async (user: User) => user);

    await service.onModuleInit();

    const createdUser = userRepository.create.mock.calls[0][0];
    expect(createdUser.username).toBe('deploy-admin');
    expect(createdUser.role).toBe('ADMIN');
    expect(createdUser.password).not.toBe('configured-password');
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when an enabled seed has no configured password', async () => {
    process.env.SEED_DEFAULT_USER = 'true';
    process.env.INITIAL_ADMIN_USERNAME = 'deploy-admin';
    delete process.env.INITIAL_ADMIN_PASSWORD;
    userRepository.count.mockResolvedValue(0);

    await expect(service.onModuleInit()).rejects.toThrow(
      'INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD son obligatorios',
    );
  });
});
