import { Injectable, NotFoundException, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase.service';
import { AuthService } from '../auth/auth.service';
import { MondayService } from '../monday/monday.service';
import { SignatureService } from '../signature/signature.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { ApprovalService } from './approval.service';
import {
  InitiateEvaluationRequest,
  InitiateEvaluationResponse,
  GetFormResponse,
  SubmitFormRequest,
  SubmitFormResponse,
  FormSubmission,
  TOKEN_EXPIRY_HOURS_DEFAULT,
} from '@veepie-forms/shared';

const VALUE_TO_MONDAY_ID: Record<number, number> = {
  0: 10,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

const TENANT_BOARDS: Record<string, {
  control: string;
  evaluation: string;
  evaluatorNameColumn: string;
  signatureColumn: string;
}> = {
  'vitalab': {
    control: '18405688011',
    evaluation: '18406881785',
    evaluatorNameColumn: 'text_mm207h73',
    signatureColumn: 'signaturexyw2st9e',
  },
  'vitalab-pp': {
    control: '18405904114',
    evaluation: '18404678821',
    evaluatorNameColumn: 'text_mm20524v',
    signatureColumn: 'signatureh1rayk4h',
  },
};

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private monday: MondayService,
    private signature: SignatureService,
    private audit: AuditService,
    private email: EmailService,
    private config: ConfigService,
    @Inject(forwardRef(() => ApprovalService))
    private approvalService: ApprovalService,
  ) {}

  async initiateEvaluation(
    req: InitiateEvaluationRequest,
    actorIp?: string,
    ccEmail?: string,
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
        monday_control_item_id: req.monday_item_id,
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
      cc: ccEmail,
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
        cc_email: ccEmail,
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
      (err) => this.logger.error('Monday sync error:', err),
    );

    return {
      success: true,
      submission_id: submissionRecord.id,
      message: 'Avaliação enviada com sucesso. O coordenador será notificado.',
    };
  }

  private async syncToMonday(
    tokenRecord: any,
    submissionRecord: any,
    sigRecord: any,
    actorIp: string,
    actorAgent: string,
  ) {
    try {
      const { data: tenant } = await this.supabase.db
        .from('tenants')
        .select('slug')
        .eq('id', tokenRecord.tenant_id)
        .single();

      const boards = TENANT_BOARDS[tenant?.slug ?? 'vitalab'];
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
      columnValues[boards.evaluatorNameColumn] = submissionRecord.evaluator_name;

      await this.monday.updateItemColumns(
        tokenRecord.monday_board_id,
        tokenRecord.monday_item_id,
        columnValues,
      );

      // A assinatura do avaliador é best-effort: se a coluna de arquivo mudar
      // de id no board, o upload falha — mas isso JAMAIS pode impedir o
      // acionamento da aprovação do RH (assinatura do coordenador).
      let mondayFileId: string | null = null;
      try {
        mondayFileId = await this.monday.uploadSignatureFile(
          tokenRecord.monday_item_id,
          boards.signatureColumn,
          sigRecord.png_base64,
          `assinatura_${tokenRecord.collaborator_name.replace(/\s+/g, '_')}.png`,
        );
      } catch (sigErr) {
        this.logger.error(
          'Falha no upload da assinatura do avaliador (seguindo para aprovação do RH):',
          sigErr,
        );
        await this.supabase.db
          .from('form_submissions')
          .update({ monday_sync_error: `signature_upload_failed: ${String(sigErr)}` })
          .eq('id', submissionRecord.id);
      }

      await this.supabase.db
        .from('evaluation_tokens')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);

      await this.supabase.db
        .from('form_submissions')
        .update({ monday_synced_at: new Date().toISOString() })
        .eq('id', submissionRecord.id);

      if (mondayFileId) {
        await this.supabase.db
          .from('signature_records')
          .update({ monday_file_id: mondayFileId })
          .eq('id', sigRecord.id);
      }

      await this.audit.log({
        tokenId: tokenRecord.id,
        tenantId: tokenRecord.tenant_id,
        action: 'monday_updated',
        actorIp,
        actorAgent,
        metadata: { monday_file_id: mondayFileId },
      });

      await this.approvalService.initiateApproval(tokenRecord.id, actorIp).catch(
        (err) => this.logger.error('Failed to initiate RH approval:', err),
      );

    } catch (err) {
      await this.supabase.db
        .from('form_submissions')
        .update({ monday_sync_error: String(err) })
        .eq('id', submissionRecord.id);

      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Recuperação (manutenção). Duas ações independentes e controladas,
  // sem reescrever competências (evita regredir o "Não Aplicável" do
  // PROCEDIMENTOS, que usa id 6 em vez de 10):
  //   - restoreSignature: re-sobe a assinatura do avaliador (salva no
  //     Supabase) na coluna atual do board. NÃO envia e-mail.
  //   - reissueApproval: gera um novo link de aprovação e ENVIA e-mail
  //     ao Gestor RH (só quando explicitamente ligado).
  // ──────────────────────────────────────────────────────────────────

  /**
   * Lista tokens não concluídos (status != 'submitted') que já têm submissão.
   * Observação: casos com upload de assinatura perdido costumam estar como
   * 'submitted' e NÃO aparecem aqui — use resyncToMonday por item/token.
   */
  async listResyncCandidates() {
    const { data: tokens } = await this.supabase.db
      .from('evaluation_tokens')
      .select(
        'id, collaborator_name, evaluator_name, monday_item_id, monday_board_id, tenant_id, status, created_at',
      )
      .neq('status', 'submitted')
      .order('created_at', { ascending: false })
      .limit(200);

    const candidates: any[] = [];

    for (const t of tokens ?? []) {
      const { data: subs } = await this.supabase.db
        .from('form_submissions')
        .select('id')
        .eq('token_id', t.id)
        .limit(1);

      if (!subs || subs.length === 0) continue;

      const { data: sigs } = await this.supabase.db
        .from('signature_records')
        .select('id')
        .eq('token_id', t.id)
        .eq('signer_role', 'evaluator')
        .limit(1);

      const { data: appr } = await this.supabase.db
        .from('approval_tokens')
        .select('id')
        .eq('evaluation_token_id', t.id)
        .limit(1);

      candidates.push({
        token_id: t.id,
        collaborator_name: t.collaborator_name,
        evaluator_name: t.evaluator_name,
        monday_item_id: t.monday_item_id,
        monday_board_id: t.monday_board_id,
        status: t.status,
        has_evaluator_signature: !!sigs && sigs.length > 0,
        approval_initiated: !!appr && appr.length > 0,
        created_at: t.created_at,
      });
    }

    return { count: candidates.length, candidates };
  }

  /**
   * Recupera um token/avaliação específico.
   * @param idOrItem token_id (padrão) ou monday_item_id quando opts.byItem.
   * @param opts.restoreSignature (padrão true) re-sobe a assinatura do avaliador.
   * @param opts.reissueApproval (padrão false) reenvia o link e e-mail ao RH.
   * @param opts.dryRun apenas inspeciona.
   */
  async resyncToMonday(
    idOrItem: string,
    actorIp = 'resync',
    opts: {
      byItem?: boolean;
      restoreSignature?: boolean;
      reissueApproval?: boolean;
      dryRun?: boolean;
    } = {},
  ) {
    const restoreSignature = opts.restoreSignature !== false; // padrão: true
    const reissueApproval = opts.reissueApproval === true;    // padrão: false

    let tokenRecord: any = null;
    if (opts.byItem) {
      const { data } = await this.supabase.db
        .from('evaluation_tokens')
        .select('*')
        .eq('monday_item_id', idOrItem)
        .order('created_at', { ascending: false })
        .limit(1);
      tokenRecord = data?.[0] ?? null;
    } else {
      const { data } = await this.supabase.db
        .from('evaluation_tokens')
        .select('*')
        .eq('id', idOrItem)
        .single();
      tokenRecord = data;
    }

    if (!tokenRecord) throw new NotFoundException('Token de avaliação não encontrado.');

    const { data: sigs } = await this.supabase.db
      .from('signature_records')
      .select('*')
      .eq('token_id', tokenRecord.id)
      .eq('signer_role', 'evaluator')
      .order('created_at', { ascending: false })
      .limit(1);

    const sigRecord = sigs?.[0] ?? null;

    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('slug')
      .eq('id', tokenRecord.tenant_id)
      .single();

    const boards = TENANT_BOARDS[tenant?.slug ?? 'vitalab'];

    const state = {
      token_id: tokenRecord.id,
      collaborator_name: tokenRecord.collaborator_name,
      status: tokenRecord.status,
      monday_item_id: tokenRecord.monday_item_id,
      monday_board_id: tokenRecord.monday_board_id,
      signature_column: boards.signatureColumn,
      has_evaluator_signature_saved: !!sigRecord?.png_base64,
    };

    if (opts.dryRun) {
      return {
        reprocessed: false,
        reason: 'dry_run',
        actions: { restoreSignature, reissueApproval },
        state,
      };
    }

    const result: any = {};

    if (restoreSignature) {
      if (!sigRecord?.png_base64) {
        result.signature = { ok: false, reason: 'no_signature_saved' };
      } else {
        try {
          const mondayFileId = await this.monday.uploadSignatureFile(
            tokenRecord.monday_item_id,
            boards.signatureColumn,
            sigRecord.png_base64,
            `assinatura_${tokenRecord.collaborator_name.replace(/\s+/g, '_')}.png`,
          );
          await this.supabase.db
            .from('signature_records')
            .update({ monday_file_id: mondayFileId })
            .eq('id', sigRecord.id);
          result.signature = { ok: true, monday_file_id: mondayFileId };
        } catch (err) {
          result.signature = { ok: false, error: String(err) };
        }
      }
    }

    if (reissueApproval) {
      try {
        const appr = await this.approvalService.initiateApproval(tokenRecord.id, actorIp);
        result.approval = appr
          ? { ok: true, ...appr }
          : { ok: false, reason: 'initiate_returned_null' };
      } catch (err) {
        result.approval = { ok: false, error: String(err) };
      }
    }

    return {
      reprocessed: true,
      actions: { restoreSignature, reissueApproval },
      state,
      result,
    };
  }
}
