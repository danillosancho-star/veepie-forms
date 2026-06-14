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

// Board IDs fixos do Vitalab
const VITALAB_BOARDS: Record<string, { control: string; evaluation: string }> = {
  'vitalab': {
    control: '18405688011',    // QDR-DRH-011 — board de controle KNC
    evaluation: '18406881785', // QDR-DRH-011.1 — board de avaliação KNC
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

  // ── 1. Inicia uma avaliação: cria token e envia e-mail ──────────────────
  async initiateEvaluation(
    req: InitiateEvaluationRequest,
    actorIp?: string,
  ): Promise<InitiateEvaluationResponse> {
    // Busca o tenant
    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('*')
      .eq('id', req.tenant_id)
      .single();

    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    // Busca o item no board de CONTROLE para obter nome e cargo
    const boards = VITALAB_BOARDS[tenant.slug];
    if (!boards) throw new NotFoundException('Configuração de boards não encontrada.');

    const item = await this.monday.getItem(boards.control, req.monday_item_id);
    if (!item) throw new NotFoundException('Colaborador não encontrado no Monday.');

    // Identifica a função pela coluna Cargo do board de controle
    const funcaoColumn = item.column_values.find((c) => c.id === 'text_mm1tq1pe');
    const funcaoValue = funcaoColumn?.text ?? '';

    // Busca o schema de competências para essa função
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

    // Cria um item novo no board de AVALIAÇÃO (011.1)
    const evaluationItemId = await this.monday.createItem(
      boards.evaluation,
      item.name,
    );

    // Define expiração
    const expiresInHours = req.expires_in_hours ?? TOKEN_EXPIRY_HOURS_DEFAULT;
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    // Cria o token no banco — usa o board e item de AVALIAÇÃO
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

    // Assina o JWT
    const jwt = this.auth.signEvaluationToken(
      { sub: tokenRecord.id, tenant: tenant.slug, item: evaluationItemId },
      expiresInHours,
    );

    const webUrl = this.config.get<string>('app.webUrl')!;
    const evaluationUrl = `${webUrl}/avaliacao?token=${jwt}`;

    // Envia e-mail para o avaliador
    await this.email.sendEvaluationLink({
      to: req.evaluator_email,
      evaluatorName: req.evaluator_name,
      collaboratorName: item.name,
      evaluationUrl,
      expiresAt,
    });

    // Audit
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

  // ── 2. Retorna o formulário para o avaliador preencher ──────────────────
  async getForm(jwtToken: string, actorIp?: string): Promise<GetFormResponse> {
    const payload = await this.auth.verifyEvaluationToken(jwtToken);
    const tokenRecord = await this.auth.validateTokenRecord(payload.sub);

    // Marca como aberto
    await this.auth.markTokenOpened(tokenRecord.id);

    // Busca o schema de competências
    const { data: schema } = await this.supabase.db
      .from('function_schemas')
      .select('*')
      .eq('id', tokenRecord.function_schema_id)
      .single();

    // Audit
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

  // ── 3. Submete o formulário preenchido com assinatura ───────────────────
  async submitForm(
    req: SubmitFormRequest,
    actorIp: string,
    actorAgent: string,
  ): Promise<SubmitFormResponse> {
    const tokenRecord = await this.auth.validateTokenRecord(req.token_id);

    // Monta a submissão
    const submission: FormSubmission = {
      token_id: req.token_id,
      answers: req.answers,
      improvement_notes: req.improvement_notes,
      training_needs: req.training_needs,
      evaluator_name: req.evaluator_name,
      submitted_at: new Date().toISOString(),
    };

    // Persiste a submissão
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

    // Gera hash do documento para a assinatura
    const documentHash = this.signature.hashDocument(submission);

    // Salva assinatura no Supabase
    const sigRecord = await this.signature.saveSignature({
      tokenId: req.token_id,
      signerName: req.evaluator_name,
      signerRole: 'evaluator',
      ipAddress: actorIp,
      userAgent: actorAgent,
      documentHash,
      pngBase64: req.signature_png_base64,
    });

    // Audit
    await this.audit.log({
      tokenId: req.token_id,
      tenantId: tokenRecord.tenant_id,
      action: 'signature_captured',
      actorIp,
      actorAgent,
      metadata: { document_hash: documentHash, signer_role: 'evaluator' },
    });

    // Sincroniza com o Monday (async — não bloqueia a resposta)
    this.syncToMonday(tokenRecord, submissionRecord, sigRecord, actorIp, actorAgent).catch(
      (err) => console.error('Monday sync error:', err),
    );

    return {
      success: true,
      submission_id: submissionRecord.id,
      message: 'Avaliação enviada com sucesso. O coordenador será notificado.',
    };
  }

  // ── Sincronização com o Monday ───────────────────────────────────────────
  private async syncToMonday(
    tokenRecord: any,
    submissionRecord: any,
    sigRecord: any,
    actorIp: string,
    actorAgent: string,
  ) {
    try {
      const columnValues: Record<string, unknown> = {};

      // Respostas das competências com IDs corretos do Monday
      for (const answer of submissionRecord.answers) {
        const mondayId = VALUE_TO_MONDAY_ID[answer.value];
        if (mondayId !== undefined) {
          columnValues[answer.monday_column_id] = { ids: [mondayId] };
        }
      }

      // Campos de texto livres
      if (submissionRecord.improvement_notes) {
        columnValues['long_text_mm1kjtqv'] = { text: submissionRecord.improvement_notes };
      }
      if (submissionRecord.training_needs) {
        columnValues['long_textbfgxg6zh'] = { text: submissionRecord.training_needs };
      }
      columnValues['text_mm207h73'] = submissionRecord.evaluator_name;

      // Atualiza as colunas no board de AVALIAÇÃO (011.1)
      await this.monday.updateItemColumns(
        tokenRecord.monday_board_id,
        tokenRecord.monday_item_id,
        columnValues,
      );

      // Upload da assinatura para o Monday
      const mondayFileId = await this.monday.uploadSignatureFile(
        tokenRecord.monday_item_id,
        'signaturexyw2st9e',
        sigRecord.png_base64,
        `assinatura_${tokenRecord.collaborator_name.replace(/\s+/g, '_')}.png`,
      );

      // Atualiza o token para submitted
      await this.supabase.db
        .from('evaluation_tokens')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);

      // Atualiza a submissão com o sync
      await this.supabase.db
        .from('form_submissions')
        .update({ monday_synced_at: new Date().toISOString() })
        .eq('id', submissionRecord.id);

      // Atualiza o file_id na assinatura
      await this.supabase.db
        .from('signature_records')
        .update({ monday_file_id: mondayFileId })
        .eq('id', sigRecord.id);

      // Audit
      await this.audit.log({
        tokenId: tokenRecord.id,
        tenantId: tokenRecord.tenant_id,
        action: 'monday_updated',
        actorIp,
        actorAgent,
        metadata: { monday_file_id: mondayFileId },
      });

      // Notifica o coordenador por e-mail
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
      // Salva o erro na submissão para retry manual
      await this.supabase.db
        .from('form_submissions')
        .update({ monday_sync_error: String(err) })
        .eq('id', submissionRecord.id);

      throw err;
    }
  }
}