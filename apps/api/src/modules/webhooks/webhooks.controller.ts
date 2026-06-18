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
    pulseId?: number;
    itemId?: number;
    userId: number;
  };
  challenge?: string;
}

// ID da coluna "E-mail do Avaliador" por board de controle
const EMAIL_COLUMN_BY_BOARD: Record<string, string> = {
  '18405688011': 'email_mm4ef62',   // QDR-DRH-011 — KNC
  '18405904114': 'email_mm4e9mg9',  // QDR-DRH-012 — PP
};

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
    if (body.challenge) {
      this.logger.log('Monday webhook challenge received');
      return { challenge: body.challenge };
    }

    const event = body.event!;
    const boardId = event.boardId;
    const itemId = event.pulseId ?? event.itemId;

    this.logger.log(`Webhook received — board: ${boardId}, item: ${itemId}`);

    if (!itemId) {
      this.logger.warn('No itemId in webhook payload', JSON.stringify(body));
      return { success: false, message: 'No itemId found' };
    }

    // Busca o tenant pelo board de controle
    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('*')
      .eq('monday_board_id', String(boardId))
      .single();

    if (!tenant) {
      this.logger.warn(`No tenant found for board ${boardId}`);
      return { success: false };
    }

    const item = await this.monday.getItem(String(boardId), String(itemId));
    if (!item) {
      this.logger.warn(`Item ${itemId} not found`);
      return { success: false };
    }

    // Busca o e-mail usando o ID correto para cada board
    const emailColumnId = EMAIL_COLUMN_BY_BOARD[String(boardId)] ?? 'email_mm4ef62';
    const emailColumn = item.column_values.find((c) => c.id === emailColumnId);
    const rawValue = emailColumn?.value ?? '{}';
    let evaluatorEmail = '';
    try {
      const parsed = JSON.parse(rawValue);
      evaluatorEmail = parsed.email ?? '';
    } catch {
      evaluatorEmail = emailColumn?.text ?? '';
    }

    if (!evaluatorEmail) {
      this.logger.warn(`No evaluator email for item ${itemId} on board ${boardId}`);
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