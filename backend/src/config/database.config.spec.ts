import { ConfigService } from '@nestjs/config';
import { databaseConfig } from './database.config';

describe('databaseConfig', () => {
  it('uses migrations instead of automatic schema synchronization', () => {
    const options = databaseConfig(new ConfigService());

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
    expect(options.migrations).toEqual([
      expect.stringMatching(/database[\\/]+migrations/),
    ]);
  });
});
