import { ServiceUnavailableException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertConfiguration } from './alert-configuration.entity';
import { AlertsMailService } from './alerts-mail.service';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { Repository } from 'typeorm';

describe('AlertsService', () => {
  const cluster = {
    id: 36,
    name: 'Datacenter 1',
    timezone: 'America/Argentina/Buenos_Aires',
  };
  let service: AlertsService;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clusterRepository: { findById: jest.Mock };
  let mail: { isConfigured: jest.Mock; sendMail: jest.Mock };

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue({
        temperatureLimit: 30,
        humidityLimit: 80,
        recipients: ['alerts@example.com'],
      }),
      create: jest.fn((configuration) => configuration),
      save: jest.fn().mockImplementation(async (configuration) => configuration),
    };
    clusterRepository = { findById: jest.fn().mockResolvedValue(cluster) };
    mail = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    service = new AlertsService(
      repository as unknown as Repository<AlertConfiguration>,
      clusterRepository as unknown as ClusterRepository,
      mail as unknown as AlertsMailService,
    );
  });

  it('uses the default limits until a cluster configuration is saved', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.getConfiguration(cluster.id)).resolves.toEqual({
      temperatureLimit: 30,
      humidityLimit: 80,
      recipients: [],
      smtpConfigured: true,
    });
  });

  it('saves thresholds and normalized recipient addresses', async () => {
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      temperatureLimit: 28.5,
      humidityLimit: 75,
      recipients: ['alerts@example.com'],
    });

    await service.updateConfiguration(cluster.id, {
      temperatureLimit: 28.5,
      humidityLimit: 75,
      recipients: [' alerts@example.com '],
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        temperatureLimit: 28.5,
        humidityLimit: 75,
        recipients: ['alerts@example.com'],
      }),
    );
  });

  it('sends an individual email for every sensor reading at or above its limit', async () => {
    await service.notifyThresholds(cluster, {
      temperature1: 32.4,
      temperature2: 25,
      humidity1: 79,
      humidity2: 80,
    });

    expect(mail.sendMail).toHaveBeenCalledTimes(2);
    expect(mail.sendMail).toHaveBeenCalledWith(
      ['alerts@example.com'],
      '[ClusterControl] Temperatura elevada - Datacenter 1',
      expect.stringContaining('32.4 °C'),
    );
    expect(mail.sendMail).toHaveBeenCalledWith(
      ['alerts@example.com'],
      '[ClusterControl] Humedad elevada - Datacenter 1',
      expect.stringContaining('80.0 %'),
    );
  });

  it('sends another email for a later reading that remains above the limit', async () => {
    const readings = {
      temperature1: 32,
      temperature2: 25,
      humidity1: 70,
      humidity2: 70,
    };

    await service.notifyThresholds(cluster, readings);
    await service.notifyThresholds(cluster, readings);

    expect(mail.sendMail).toHaveBeenCalledTimes(2);
  });

  it('does not send an alert when no recipients are configured', async () => {
    repository.findOne.mockResolvedValue({
      temperatureLimit: 30,
      humidityLimit: 80,
      recipients: [],
    });

    await service.notifyThresholds(cluster, {
      temperature1: 40,
      temperature2: 25,
      humidity1: 90,
      humidity2: 70,
    });

    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('rejects a test email if no recipients are configured', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.sendTestEmail(cluster.id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
});
