import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class AlertsMailService {
  private readonly transporter?: Transporter;
  private readonly from?: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('mail.host');
    const user = config.get<string>('mail.user');
    const password = config.get<string>('mail.password');
    this.from = config.get<string>('mail.from') ?? user;
    const port = config.get<number>('mail.port') ?? 587;
    const secure = config.get<boolean>('mail.secure') ?? false;

    if (
      host &&
      user &&
      password &&
      this.from &&
      Number.isInteger(port) &&
      port > 0 &&
      port <= 65535
    ) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass: password },
      });
    }
  }

  isConfigured(): boolean {
    return this.transporter !== undefined;
  }

  async sendMail(
    recipients: string[],
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.transporter || !this.from) {
      throw new ServiceUnavailableException(
        'El servidor SMTP no está configurado',
      );
    }

    await this.transporter.sendMail({
      from: this.from,
      to: recipients,
      subject,
      html,
    });
  }
}
