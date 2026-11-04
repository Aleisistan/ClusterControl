import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { AlertConfiguration } from './alert-configuration.entity';
import { AlertsMailService } from './alerts-mail.service';
import { UpdateAlertConfigurationDto } from './dto/update-alert-configuration.dto';

type AlertActiveField = 'temperatureActive' | 'humidityActive';

const TEMPERATURE_RECOVERY_OFFSET = 3;
const HUMIDITY_RECOVERY_OFFSET = 10;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(AlertConfiguration)
    private readonly configurations: Repository<AlertConfiguration>,
    private readonly clusters: ClusterRepository,
    private readonly mail: AlertsMailService,
  ) {}

  async getConfiguration(clusterId: number) {
    const cluster = await this.clusters.findById(clusterId);
    if (!cluster) throw new NotFoundException('Cluster no encontrado');

    const configuration = await this.configurations.findOne({
      where: { cluster: { id: clusterId } },
    });

    return {
      temperatureLimit: configuration?.temperatureLimit ?? 30,
      humidityLimit: configuration?.humidityLimit ?? 80,
      temperatureRecoveryLimit:
        configuration?.temperatureRecoveryLimit ??
        Math.max(
          -40,
          (configuration?.temperatureLimit ?? 30) - TEMPERATURE_RECOVERY_OFFSET,
        ),
      humidityRecoveryLimit:
        configuration?.humidityRecoveryLimit ??
        Math.max(
          0,
          (configuration?.humidityLimit ?? 80) - HUMIDITY_RECOVERY_OFFSET,
        ),
      temperatureEnabled: configuration?.temperatureEnabled ?? true,
      humidityEnabled: configuration?.humidityEnabled ?? true,
      recipients: configuration?.recipients ?? [],
      smtpConfigured: this.mail.isConfigured(),
    };
  }

  async updateConfiguration(
    clusterId: number,
    data: UpdateAlertConfigurationDto,
  ) {
    const cluster = await this.clusters.findById(clusterId);
    if (!cluster) throw new NotFoundException('Cluster no encontrado');
    if (
      data.temperatureRecoveryLimit !== undefined &&
      data.temperatureRecoveryLimit >= data.temperatureLimit
    ) {
      throw new BadRequestException(
        'El umbral de recuperación de temperatura debe ser menor que el límite máximo',
      );
    }
    if (
      data.humidityRecoveryLimit !== undefined &&
      data.humidityRecoveryLimit >= data.humidityLimit
    ) {
      throw new BadRequestException(
        'El umbral de recuperación de humedad debe ser menor que el límite máximo',
      );
    }

    const configuration =
      (await this.configurations.findOne({
        where: { cluster: { id: clusterId } },
      })) ?? this.configurations.create({ cluster });

    configuration.temperatureLimit = data.temperatureLimit;
    configuration.humidityLimit = data.humidityLimit;
    configuration.temperatureRecoveryLimit =
      data.temperatureRecoveryLimit ??
      Math.max(-40, data.temperatureLimit - TEMPERATURE_RECOVERY_OFFSET);
    configuration.humidityRecoveryLimit =
      data.humidityRecoveryLimit ??
      Math.max(0, data.humidityLimit - HUMIDITY_RECOVERY_OFFSET);
    configuration.temperatureEnabled = data.temperatureEnabled ?? true;
    configuration.humidityEnabled = data.humidityEnabled ?? true;
    configuration.temperatureActive = false;
    configuration.humidityActive = false;
    configuration.temperature1Active = false;
    configuration.temperature2Active = false;
    configuration.humidity1Active = false;
    configuration.humidity2Active = false;
    const recipients = [...(configuration.recipients ?? []), ...data.recipients]
      .map((address) => address.trim())
      .filter(Boolean)
      .filter(
        (address, index, addresses) =>
          addresses.findIndex(
            (candidate) => candidate.toLowerCase() === address.toLowerCase(),
          ) === index,
      );
    configuration.recipients = recipients;

    await this.configurations.save(configuration);
    return this.getConfiguration(clusterId);
  }

  async sendTestEmail(clusterId: number): Promise<void> {
    const cluster = await this.clusters.findById(clusterId);
    if (!cluster) throw new NotFoundException('Cluster no encontrado');
    const configuration = await this.configurations.findOne({
      where: { cluster: { id: clusterId } },
    });

    if (!configuration?.recipients.length) {
      throw new ServiceUnavailableException(
        'Configura al menos un destinatario antes de probar el correo',
      );
    }

    await this.mail.sendMail(
      configuration.recipients,
      `[ClusterControl] Prueba de alertas - ${cluster.name}`,
      `<p>El envío de alertas por correo para <strong>${this.escapeHtml(cluster.name)}</strong> está configurado.</p>`,
    );
  }

  async notifyThresholds(
    cluster: {
      id: number;
      name: string;
      timezone?: string | null;
    },
    readings: {
      temperature1: number;
      temperature2: number;
      humidity1: number;
      humidity2: number;
    },
  ): Promise<void> {
    const configuration = await this.configurations.findOne({
      where: { cluster: { id: cluster.id } },
    });
    if (!configuration?.recipients.length) return;

    const temperatureAverage =
      (readings.temperature1 + readings.temperature2) / 2;
    const humidityAverage = (readings.humidity1 + readings.humidity2) / 2;
    if (
      !Number.isFinite(temperatureAverage) ||
      !Number.isFinite(humidityAverage)
    ) {
      this.logger.warn(
        `[ALERTAS] Lecturas inválidas para cluster ${cluster.id}: ` +
          `temperatura=${readings.temperature1},${readings.temperature2}; ` +
          `humedad=${readings.humidity1},${readings.humidity2}`,
      );
      return;
    }

    const conditions = [
      {
        values: [readings.temperature1, readings.temperature2],
        average: temperatureAverage,
        limit: configuration.temperatureLimit ?? 30,
        recoveryLimit:
          configuration.temperatureRecoveryLimit ??
          Math.max(
            -40,
            (configuration.temperatureLimit ?? 30) -
              TEMPERATURE_RECOVERY_OFFSET,
          ),
        enabled: configuration.temperatureEnabled ?? true,
        activeField: 'temperatureActive' as AlertActiveField,
        parameter: 'Temperatura',
        unit: '°C',
      },
      {
        values: [readings.humidity1, readings.humidity2],
        average: humidityAverage,
        limit: configuration.humidityLimit ?? 80,
        recoveryLimit:
          configuration.humidityRecoveryLimit ??
          Math.max(
            0,
            (configuration.humidityLimit ?? 80) - HUMIDITY_RECOVERY_OFFSET,
          ),
        enabled: configuration.humidityEnabled ?? true,
        activeField: 'humidityActive' as AlertActiveField,
        parameter: 'Humedad',
        unit: '%',
      },
    ].filter(({ enabled }) => enabled);

    for (const condition of conditions) {
      const isActive = configuration[condition.activeField];
      if (isActive && condition.average <= condition.recoveryLimit) {
        configuration[condition.activeField] = false;
        await this.configurations.save(configuration);
        continue;
      }
      if (isActive || condition.average < condition.limit) continue;

      const title =
        condition.parameter === 'Temperatura'
          ? 'Temperatura elevada'
          : 'Humedad elevada';
      const date = new Intl.DateTimeFormat('es-AR', {
        timeZone: cluster.timezone || 'America/Argentina/Buenos_Aires',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date());
      const html = this.buildAlertEmail({
        title,
        clusterName: cluster.name,
        parameter: condition.parameter,
        values: condition.values,
        average: condition.average,
        limit: condition.limit,
        unit: condition.unit,
        date,
      });

      try {
        await this.mail.sendMail(
          configuration.recipients,
          `[ClusterControl] ${title} - ${cluster.name}`,
          html,
        );
        configuration[condition.activeField] = true;
        await this.configurations.save(configuration);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error(
          `No se pudo enviar alerta de ${condition.parameter.toLowerCase()} ` +
            `para cluster ${cluster.id}: ${reason}`,
        );
      }
    }
  }

  private buildAlertEmail(alert: {
    title: string;
    clusterName: string;
    parameter: string;
    values: number[];
    average: number;
    limit: number;
    unit: string;
    date: string;
  }): string {
    return `
      <h2>${alert.title}</h2>
      <p>Se detectó una condición fuera de los parámetros establecidos.</p>
      <table style="border-collapse:collapse">
        <tr><th style="text-align:left;padding:6px">Parámetro</th><th style="text-align:left;padding:6px">Valor</th></tr>
        <tr><td style="padding:6px">Cluster</td><td style="padding:6px">${this.escapeHtml(alert.clusterName)}</td></tr>
        <tr><td style="padding:6px">Sensor 1</td><td style="padding:6px">${alert.values[0].toFixed(1)} ${alert.unit}</td></tr>
        <tr><td style="padding:6px">Sensor 2</td><td style="padding:6px">${alert.values[1].toFixed(1)} ${alert.unit}</td></tr>
        <tr><td style="padding:6px">${alert.parameter} promedio</td><td style="padding:6px"><strong>${alert.average.toFixed(1)} ${alert.unit}</strong></td></tr>
        <tr><td style="padding:6px">${alert.parameter} máxima</td><td style="padding:6px">${alert.limit} ${alert.unit}</td></tr>
        <tr><td style="padding:6px">Fecha</td><td style="padding:6px">${this.escapeHtml(alert.date)}</td></tr>
      </table>
      <p>Esta notificación fue generada automáticamente por ClusterControl.</p>
    `;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }
}
