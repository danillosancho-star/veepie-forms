import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private from: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('email.resendApiKey')!);
    const name = this.config.get<string>('email.fromName')!;
    const addr = this.config.get<string>('email.from')!;
    this.from = `${name} <${addr}>`;
  }

  async sendEvaluationLink(params: {
    to: string;
    evaluatorName: string;
    collaboratorName: string;
    evaluationUrl: string;
    expiresAt: Date;
  }) {
    const expiry = params.expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    try {
      await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: `Avaliação de competências — ${params.collaboratorName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
            <h2 style="color: #1a1a2e;">Olá, ${params.evaluatorName}!</h2>
            <p>Você recebeu uma solicitação para avaliar as competências de <strong>${params.collaboratorName}</strong>.</p>
            <p>Clique no botão abaixo para acessar o formulário de avaliação:</p>
            <div style="margin: 32px 0;">
              <a href="${params.evaluationUrl}"
                 style="background: #4f46e5; color: white; padding: 14px 28px;
                        border-radius: 8px; text-decoration: none; font-weight: 600;">
                Abrir formulário de avaliação
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              ⏰ Este link expira em: <strong>${expiry}</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">
              Veepie Forms — Se você não esperava este e-mail, ignore-o.
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send evaluation link email', err);
    }
  }

  async sendCompletionNotification(params: {
    to: string;
    collaboratorName: string;
    evaluatorName: string;
  }) {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: `Avaliação concluída — ${params.collaboratorName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
            <h2 style="color: #1a1a2e;">Avaliação concluída ✓</h2>
            <p>
              A avaliação de competências de <strong>${params.collaboratorName}</strong>
              foi preenchida e assinada por <strong>${params.evaluatorName}</strong>.
            </p>
            <p>O board do Monday.com foi atualizado automaticamente.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Veepie Forms</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send completion notification email', err);
    }
  }

  async sendApprovalLink(params: {
    to: string;
    approverName: string;
    collaboratorName: string;
    evaluatorName: string;
    approvalUrl: string;
    expiresAt: Date;
  }) {
    const expiry = params.expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    try {
      await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: `Aprovação de avaliação — ${params.collaboratorName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
            <h2 style="color: #1a1a2e;">Olá, ${params.approverName}!</h2>
            <p>
              A avaliação de competências de <strong>${params.collaboratorName}</strong>
              foi preenchida por <strong>${params.evaluatorName}</strong> e aguarda sua aprovação e assinatura.
            </p>
            <div style="margin: 32px 0;">
              <a href="${params.approvalUrl}"
                 style="background: #059669; color: white; padding: 14px 28px;
                        border-radius: 8px; text-decoration: none; font-weight: 600;">
                Revisar e assinar avaliação
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              ⏰ Este link expira em: <strong>${expiry}</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Veepie Forms</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send approval link email', err);
    }
  }
}