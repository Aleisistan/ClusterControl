import {
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

    const configuration =
      (await this.configurations.findOne({
        where: { cluster: { id: clusterId } },
      })) ?? this.configurations.create({ cluster });

    configuration.temperatureLimit = data.temperatureLimit;
    configuration.humidityLimit = data.humidityLimit;
    configuration.recipients = data.recipients.map((address) =>
      address.trim(),
    );

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

    const conditions = [
      ...[readings.temperature1, readings.temperature2]
        .map((value, index) => ({
          value,
          limit: configuration.temperatureLimit,
          sensor: `Sensor ${index + 1}`,
          parameter: 'Temperatura',
          unit: '°C',
        }))
        .filter(({ value, limit }) => value >= limit),
      ...[readings.humidity1, readings.humidity2]
        .map((value, index) => ({
          value,
          limit: configuration.humidityLimit,
          sensor: `Sensor ${index + 1}`,
          parameter: 'Humedad',
          unit: '%',
        }))
        .filter(({ value, limit }) => value >= limit),
    ];

    await Promise.all(
      conditions.map(async (condition) => {
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
          sensor: condition.sensor,
          parameter: condition.parameter,
          value: condition.value,
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
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : 'Error desconocido';
          this.logger.error(
            `No se pudo enviar alerta de ${condition.parameter.toLowerCase()} ` +
              `para cluster ${cluster.id}, ${condition.sensor}: ${reason}`,
          );
        }
      }),
    );
  }

  private buildAlertEmail(alert: {
    title: string;
    clusterName: string;
    sensor: string;
    parameter: string;
    value: number;
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
        <tr><td style="padding:6px">Sensor</td><td style="padding:6px">${alert.sensor}</td></tr>
        <tr><td style="padding:6px">${alert.parameter} actual</td><td style="padding:6px">${alert.value.toFixed(1)} ${alert.unit}</td></tr>
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
