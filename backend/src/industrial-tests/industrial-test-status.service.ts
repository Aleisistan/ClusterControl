import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface RunnerStatus {
  state: 'running' | 'completed' | 'interrupted' | 'unknown' | 'failed';
  active: boolean;
  started_at: string;
  updated_at: string;
  run_directory: string;
  requested_hours: number | null;
  interval_seconds: number;
  current_cycle: number;
  completed_cycles: number;
  passed_cycles?: number;
  failed_cycles?: number;
  totals?: {
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
  };
  failed_tests?: string[];
  cycle_history?: RunnerCycleStatus[];
  last_cycle_status: 'passed' | 'failed' | null;
  finished_at?: string;
}

export interface RunnerCycleStatus {
  cycle: number;
  started_at: string;
  duration_seconds: number;
  status: 'passed' | 'failed';
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  failed_tests: string[];
}

export interface IdleRunnerStatus {
  state: 'unknown';
  active: false;
}

const STATUS_LEASE_MS = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRunnerCycleStatus(value: unknown): value is RunnerCycleStatus {
  if (!isRecord(value)) return false;
  return (
    typeof value.cycle === 'number' &&
    typeof value.started_at === 'string' &&
    typeof value.duration_seconds === 'number' &&
    (value.status === 'passed' || value.status === 'failed') &&
    typeof value.tests === 'number' &&
    typeof value.failures === 'number' &&
    typeof value.errors === 'number' &&
    typeof value.skipped === 'number' &&
    Array.isArray(value.failed_tests) &&
    value.failed_tests.every((test) => typeof test === 'string')
  );
}

function isRunnerStatus(value: unknown): value is RunnerStatus {
  if (!isRecord(value)) return false;
  const status = value;
  return (
    ['running', 'completed', 'interrupted', 'unknown', 'failed'].includes(
      String(status.state),
    ) &&
    typeof status.active === 'boolean' &&
    typeof status.started_at === 'string' &&
    typeof status.updated_at === 'string' &&
    typeof status.run_directory === 'string' &&
    (typeof status.requested_hours === 'number' ||
      status.requested_hours === null) &&
    typeof status.interval_seconds === 'number' &&
    typeof status.current_cycle === 'number' &&
    typeof status.completed_cycles === 'number' &&
    (status.passed_cycles === undefined ||
      typeof status.passed_cycles === 'number') &&
    (status.failed_cycles === undefined ||
      typeof status.failed_cycles === 'number') &&
    (status.totals === undefined ||
      (isRecord(status.totals) &&
        typeof status.totals.tests === 'number' &&
        typeof status.totals.failures === 'number' &&
        typeof status.totals.errors === 'number' &&
        typeof status.totals.skipped === 'number')) &&
    (status.failed_tests === undefined ||
      (Array.isArray(status.failed_tests) &&
        status.failed_tests.every((test) => typeof test === 'string'))) &&
    (status.cycle_history === undefined ||
      (Array.isArray(status.cycle_history) &&
        status.cycle_history.every(isRunnerCycleStatus))) &&
    (status.last_cycle_status === 'passed' ||
      status.last_cycle_status === 'failed' ||
      status.last_cycle_status === null) &&
    (status.finished_at === undefined ||
      typeof status.finished_at === 'string')
  );
}

@Injectable()
export class IndustrialTestStatusService {
  private readonly statusPath: string;

  constructor(configService: ConfigService) {
    const configuredPath = configService.get<string>(
      'industrialTests.statusPath',
    );
    this.statusPath = resolve(
      process.cwd(),
      configuredPath ?? '../tests-industriales/reports/runner-status.json',
    );
  }

  async getStatus(): Promise<RunnerStatus | IdleRunnerStatus> {
    let contents: string;
    try {
      contents = await readFile(this.statusPath, 'utf8');
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return { state: 'unknown', active: false };
      }
      throw error;
    }

    let parsedStatus: unknown;
    let parseError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        parsedStatus = JSON.parse(contents);
        parseError = undefined;
        break;
      } catch (error) {
        parseError = error;
        if (attempt < 2) {
          await new Promise((resolveRetry) => setTimeout(resolveRetry, 20));
          contents = await readFile(this.statusPath, 'utf8');
        }
      }
    }
    if (parseError !== undefined) {
      throw new InternalServerErrorException(
        'Industrial test runner status file is invalid',
      );
    }
    if (!isRunnerStatus(parsedStatus)) {
      throw new InternalServerErrorException(
        'Industrial test runner status file has an invalid shape',
      );
    }
    const status = parsedStatus;

    if (!status.active) {
      return status;
    }

    const updatedAt = Date.parse(status.updated_at);
    if (!Number.isFinite(updatedAt)) {
      throw new InternalServerErrorException(
        'Industrial test runner status timestamp is invalid',
      );
    }

    if (Date.now() - updatedAt > STATUS_LEASE_MS) {
      return { ...status, state: 'unknown', active: false };
    }

    return status;
  }
}
