import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase.service';
import { AuthService } from '../auth/auth.service';
import { MondayService } from '../monday/monday.service';
import { SignatureService } from '../signature/signature.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import {
  InitiateEvaluationRequest,
  InitiateEvaluationResponse,
  GetFormResponse,
  SubmitFormRequest,
  SubmitFormResponse,
  FormSubmission,
  TOKEN_EXPIRY_HOURS_DEFAULT,
} from '@veepie-forms/shared';

// Mapeamento valor (0-5) → ID do label no Monday
const VALUE_TO_MONDAY_ID: Record<number, number> = {
  0: 6, // Não Aplicável
  1: 1, // Não Atende
  2: 2, // Atende Parcialmente
  3: 3, // Atende
  4: 4, // Acima do Esperado
  5: 5, // Muito Acima do Esperado
};

// Board IDs por tenant
const TENANT_BOARDS: Record<string, { control: string; evaluation: string }> = {
  'vitalab': {
    control: '18405688011',    // QDR-DRH-011 — KNC
    evaluation: '18406881785', // QDR-DRH-011.1 — KNC
  },
  'vitalab-pp': {
    control: '18405904114',    // QDR-DRH-012 — PP
    evaluation: '18404678821', // QDR-DRH-012.1 — PP
  },
};

@Injectable()
export class FormsService {
  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private monday: MondayService,
    private signature: SignatureService,
    private audit: AuditService,
    private email: EmailService,
    private config: ConfigService,
  ) {}

  // ── 1. Inicia uma avaliação ─────────────────────────────────────────────
  async initiateEvaluation(
    req: InitiateEvaluationRequest,
    actorIp?: string,
  ): Promise<InitiateEvaluationResponse> {
    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('*')
      .eq('id', req.tenant_id)
      .single();

    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const boards = TENANT_BOARDS[tenant.slug];
    if (!boards) throw new NotFoundException('Configuração de boards não encontrada.');

    const item = await this.monday.getItem(boards.control, req.monday_item_id);
    if (!item) throw new NotFoundException('Colaborador não encontrado no Monday.');

    const funcaoColumn = item.column_values.find((c) => c.id === 'text_mm1tq1pe');
    const funcaoValue = funcaoColumn?.text ?? '';

    const { data: schema } = await this.supabase.db
      .from('function_schemas')
      .select('*')
      .eq('tenant_id', req.tenant_id)
      .eq('monday_function_value', funcaoValue)
      .eq('active', true)
      .single();

    if (!schema) {
      throw new NotFoundException(
        `Nenhum schema de competências encontrado para a função "${funcaoValue}".`,
      );
    }

    const evaluationItemId = await this.monday.createItem(
      boards.evaluation,
      item.name,
    );

    const expiresInHours = req.expires_in_hours ?? TOKEN_EXPIRY_HOURS_DEFAULT;
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const { data: tokenRecord, error } = await this.supabase.db
      .from('evaluation_tokens')
      .insert({
        tenant_id: req.tenant_id,
        monday_item_id: evaluationItemId,
        monday_board_id: boards.evaluation,
        function_schema_id: schema.id,
        collaborator_name: item.name,
        evaluator_email: req.evaluator_email,
        evaluator_name: req.evaluator_name,
        coordinator_email: req.coordinator_email,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const jwt = this.auth.signEvaluationToken(
      { sub: tokenRecord.id, tenant: tenant.slug, item: evaluationItemId },
      expiresInHours,
    );

    const webUrl = this.config.get<string>('app.webUrl')!;
    const evaluationUrl = `${webUrl}/avaliacao?token=${jwt}`;

    await this.email.sendEvaluationLink({
      to: req.evaluator_email,
      evaluatorName: req.evaluator_name,
      collaboratorName: item.name,
      evaluationUrl,
      expiresAt,
    });

    await this.audit.log({
      tokenId: tokenRecord.id,
      tenantId: req.tenant_id,
      action: 'token_created',
      actorIp,
      metadata: {
        evaluator_email: req.evaluator_email,
        expires_at: expiresAt.toISOString(),
        evaluation_item_id: evaluationItemId,
      },
    });

    return {
      token_id: tokenRecord.id,
      evaluation_url: evaluationUrl,
      expires_at: expiresAt.toISOString(),
    };
  }

  // ── 2. Retorna o formulário ─────────────────────────────────────────────
  async getForm(jwtToken: string, actorIp?: string): Promise<GetFormResponse> {
    const payload = await this.auth.verifyEvaluationToken(jwtToken);
    const tokenRecord = await this.auth.validateTokenRecord(payload.sub);

    await this.auth.markTokenOpened(tokenRecord.id);

    const { data: schema } = await this.supabase.db
      .from('function_schemas')
      .select('*')
      .eq('id', tokenRecord.function_schema_id)
      .single();

    await this.audit.log({
      tokenId: tokenRecord.id,
      tenantId: tokenRecord.tenant_id,
      action: 'token_opened',
      actorIp,
    });

    return {
      token: tokenRecord,
      schema,
      collaborator_name: tokenRecord.collaborator_name,
    };
  }

  // ── 3. Submete o formulário ─────────────────────────────────────────────
  async submitForm(
    req: SubmitFormRequest,
    actorIp: string,
    actorAgent: string,
  ): Promise<SubmitFormResponse> {
    const tokenRecord = await this.auth.validateTokenRecord(req.token_id);

    const submission: FormSubmission = {
      token_id: req.token_id,
      answers: req.answers,
      improvement_notes: req.improvement_notes,
      training_needs: req.training_needs,
      evaluator_name: req.evaluator_name,
      submitted_at: new Date().toISOString(),
    };

    const { data: submissionRecord, error: subError } = await this.supabase.db
      .from('form_submissions')
      .insert({
        token_id: req.token_id,
        answers: req.answers,
        improvement_notes: req.improvement_notes,
        training_needs: req.training_needs,
        evaluator_name: req.evaluator_name,
      })
      .select()
      .single();

    if (subError) throw subError;

    const documentHash = this.signature.hashDocument(submission);

    const sigRecord = await this.signature.saveSignature({
      tokenId: req.token_id,
      signerName: req.evaluator_name,
      signerRole: 'evaluator',
      ipAddress: actorIp,
      userAgent: actorAgent,
      documentHash,
      pngBase64: req.signature_png_base64,
    });

    await this.audit.log({
      tokenId: req.token_id,
      tenantId: tokenRecord.tenant_id,
      action: 'signature_captured',
      actorIp,
      actorAgent,
      metadata: { document_hash: documentHash, signer_role: 'evaluator' },
    });

    this.syncToMonday(tokenRecord, submissionRecord, sigRecord, actorIp, actorAgent).catch(
      (err) => console.error('Monday sync error:', err),
    );

    return {
      success: true,
      submission_id: submissionRecord.id,
      message: 'Avaliação enviada com sucesso. O coordenador será notificado.',
    };
  }

  // ── Sincronização com o Monday ──────────────────────────────────────────
  private async syncToMonday(
    tokenRecord: any,
    submissionRecord: any,
    sigRecord: any,
    actorIp: string,
    actorAgent: string,
  ) {
    try {
      const columnValues: Record<string, unknown> = {};

      for (const answer of submissionRecord.answers) {
        const mondayId = VALUE_TO_MONDAY_ID[answer.value];
        if (mondayId !== undefined) {
          columnValues[answer.monday_column_id] = { ids: [mondayId] };
        }
      }

      if (submissionRecord.improvement_notes) {
        columnValues['long_text_mm1kjtqv'] = { text: submissionRecord.improvement_notes };
      }
      if (submissionRecord.training_needs) {
        columnValues['long_textbfgxg6zh'] = { text: submissionRecord.training_needs };
      }
      columnValues['text_mm207h73'] = submissionRecord.evaluator_name;

      await this.monday.updateItemColumns(
        tokenRecord.monday_board_id,
        tokenRecord.monday_item_id,
        columnValues,
      );

      const mondayFileId = await this.monday.uploadSignatureFile(
        tokenRecord.monday_item_id,
        'signaturexyw2st9e',
        sigRecord.png_base64,
        `assinatura_${tokenRecord.collaborator_name.replace(/\s+/g, '_')}.png`,
      );

      await this.supabase.db
        .from('evaluation_tokens')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);

      await this.supabase.db
        .from('form_submissions')
        .update({ monday_synced_at: new Date().toISOString() })
        .eq('id', submissionRecord.id);

      await this.supabase.db
        .from('signature_records')
        .update({ monday_file_id: mondayFileId })
        .eq('id', sigRecord.id);

      await this.audit.log({
        tokenId: tokenRecord.id,
        tenantId: tokenRecord.tenant_id,
        action: 'monday_updated',
        actorIp,
        actorAgent,
        metadata: { monday_file_id: mondayFileId },
      });

      await this.email.sendCompletionNotification({
        to: tokenRecord.coordinator_email,
        collaboratorName: tokenRecord.collaborator_name,
        evaluatorName: submissionRecord.evaluator_name,
      });

      await this.audit.log({
        tokenId: tokenRecord.id,
        tenantId: tokenRecord.tenant_id,
        action: 'coordinator_notified',
      });

    } catch (err) {
      await this.supabase.db
        .from('form_submissions')
        .update({ monday_sync_error: String(err) })
        .eq('id', submissionRecord.id);

      throw err;
    }
  }
}