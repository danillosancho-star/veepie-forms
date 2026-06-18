import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FormsService } from '../forms/forms.service';
import { MondayService } from '../monday/monday.service';
import { SupabaseService } from '../../common/supabase.service';

interface MondayWebhookPayload {
  event?: {
    type: string;
    boardId: number;
    itemId: number;
    userId: number;
  };
  challenge?: string;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private forms: FormsService,
    private monday: MondayService,
    private supabase: SupabaseService,
  ) {}

  @Post('monday')
  @HttpCode(HttpStatus.OK)
  async mondayWebhook(@Body() body: MondayWebhookPayload) {
    // Verificação do endpoint pelo Monday
    if (body.challenge) {
      this.logger.log('Monday webhook challenge received');
      return { challenge: body.challenge };
    }

    const { boardId, itemId } = body.event!;
    this.logger.log(`Webhook received — board: ${boardId}, item: ${itemId}`);

    // Busca o tenant
    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('*')
      .single();

    if (!tenant) {
      this.logger.warn('No tenant found');
      return { success: false };
    }

    // Busca o item no Monday para pegar o e-mail do avaliador
    const item = await this.monday.getItem(String(boardId), String(itemId));
    if (!item) {
      this.logger.warn(`Item ${itemId} not found`);
      return { success: false };
    }

    // Coluna "E-mail do Avaliador" = email_mm4ef62
    const emailColumn = item.column_values.find((c) => c.id === 'email_mm4ef62');
    const rawValue = emailColumn?.value ?? '{}';
    let evaluatorEmail = '';
    try {
      const parsed = JSON.parse(rawValue);
      evaluatorEmail = parsed.email ?? '';
    } catch {
      evaluatorEmail = emailColumn?.text ?? '';
    }

    if (!evaluatorEmail) {
      this.logger.warn(`No evaluator email for item ${itemId}`);
      return { success: false, message: 'E-mail do avaliador não preenchido.' };
    }

    try {
      const result = await this.forms.initiateEvaluation({
        tenant_id: tenant.id,
        monday_item_id: String(itemId),
        evaluator_email: evaluatorEmail,
        evaluator_name: evaluatorEmail.split('@')[0],
        coordinator_email: tenant.coordinator_email ?? 'danillo.tourinho@s2sbs.com.br',
        expires_in_hours: 72,
      });

      this.logger.log(`Evaluation initiated: ${result.token_id} for ${item.name}`);
      return { success: true, token_id: result.token_id };
    } catch (err) {
      this.logger.error('Failed to initiate evaluation', String(err));
      return { success: false, message: String(err) };
    }
  }
}