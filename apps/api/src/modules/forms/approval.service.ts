import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SupabaseService } from '../../common/supabase.service';
import { AuthService } from '../auth/auth.service';
import { MondayService } from '../monday/monday.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { SignatureService } from '../signature/signature.service';

// Coluna Gestor RH por board de controle
const GESTOR_RH_COLUMN: Record<string, string> = {
  '18405688011': 'multiple_person_mm4gtvmh', // KNC
  '18405904114': 'multiple_person_mm4gtvmh', // PP (mesma coluna)
};

// Coluna assinatura do RH por board de avaliação
const RH_SIGNATURE_COLUMN: Record<string, string> = {
  '18406881785': 'file_mm4grbwv', // KNC 011.1
  '18404678821': 'file_mm4g5jah', // PP 012.1
};

// Board de controle por board de avaliação
const EVAL_TO_CONTROL_BOARD: Record<string, string> = {
  '18406881785': '18405688011', // KNC
  '18404678821': '18405904114', // PP
};

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private monday: MondayService,
    private email: EmailService,
    private audit: AuditService,
    private signature: SignatureService,
    private config: ConfigService,
  ) {}

  // ── Busca o e-mail do Gestor RH no Monday ─────────────────────────────
  async getGestorRhEmail(controlBoardId: string, itemId: string): Promise<{ email: string; name: string } | null> {
    const item = await this.monday.getItem(controlBoardId, itemId);
    if (!item) return null;

    const gestorColumn = item.column_values.find(
      (c) => c.id === GESTOR_RH_COLUMN[controlBoardId],
    );

    if (!gestorColumn?.value) return null;

    try {
      const parsed = JSON.parse(gestorColumn.value);
      const personId = parsed?.personsAndTeams?.[0]?.id;
      if (!personId) return null;

      // Busca o e-mail do usuário Monday pelo ID
      const data = await this.monday.getUserById(String(personId));
      return data;
    } catch {
      return null;
    }
  }

  // ── Cria token de aprovação e envia e-mail para o RH ──────────────────
  async initiateApproval(evaluationTokenId: string, actorIp?: string) {
    // Busca o token de avaliação
    const { data: evalToken } = await this.supabase.db
      .from('evaluation_tokens')
      .select('*')
      .eq('id', evaluationTokenId)
      .single();

    if (!evalToken) throw new NotFoundException('Token de avaliação não encontrado.');

    // Determina o board de controle
    const controlBoardId = EVAL_TO_CONTROL_BOARD[evalToken.monday_board_id];
    if (!controlBoardId) throw new NotFoundException('Board de controle não encontrado.');

    // Busca o item original no board de controle para pegar o Gestor RH
    // O monday_item_id do evalToken é o item do board de AVALIAÇÃO (011.1)
    // Precisamos buscar o item do board de CONTROLE pelo nome do colaborador
    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('*')
      .eq('id', evalToken.tenant_id)
      .single();

    // Busca itens do board de controle para encontrar o colaborador
    const gestorInfo = await this.findGestorRhByCollaborator(
      controlBoardId,
      evalToken.collaborator_name,
    );

    if (!gestorInfo) {
      this.logger.warn(`No Gestor RH found for ${evalToken.collaborator_name}`);
      return null;
    }

    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);

    // Cria o token de aprovação
    const { data: approvalToken, error } = await this.supabase.db
      .from('approval_tokens')
      .insert({
        evaluation_token_id: evaluationTokenId,
        tenant_id: evalToken.tenant_id,
        monday_item_id: evalToken.monday_item_id,
        monday_board_id: evalToken.monday_board_id,
        approver_email: gestorInfo.email,
        approver_name: gestorInfo.name,
        collaborator_name: evalToken.collaborator_name,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Gera JWT para o link de aprovação
    const jwt = this.auth.signEvaluationToken(
      { sub: approvalToken.id, tenant: tenant.slug, item: evalToken.monday_item_id },
      72,
    );

    const webUrl = this.config.get<string>('app.webUrl')!;
    const approvalUrl = `${webUrl}/aprovacao?token=${jwt}`;

    // Busca o resumo da submissão para incluir no e-mail
    const { data: submission } = await this.supabase.db
      .from('form_submissions')
      .select('*')
      .eq('token_id', evaluationTokenId)
      .single();

    // Envia e-mail para o Gestor RH
    await this.email.sendApprovalLink({
      to: gestorInfo.email,
      approverName: gestorInfo.name,
      collaboratorName: evalToken.collaborator_name,
      evaluatorName: submission?.evaluator_name ?? '',
      approvalUrl,
      expiresAt,
    });

    await this.audit.log({
      tokenId: evaluationTokenId,
      tenantId: evalToken.tenant_id,
      action: 'coordinator_notified',
      actorIp,
      metadata: { approver_email: gestorInfo.email, approval_token_id: approvalToken.id },
    });

    this.logger.log(`Approval link sent to ${gestorInfo.email} for ${evalToken.collaborator_name}`);
    return { approval_token_id: approvalToken.id, approvalUrl };
  }

  // ── Busca Gestor RH pelo nome do colaborador no board de controle ──────
  private async findGestorRhByCollaborator(
    controlBoardId: string,
    collaboratorName: string,
  ): Promise<{ email: string; name: string } | null> {
    const items = await this.monday.searchItemsByName(controlBoardId, collaboratorName);
    if (!items?.length) return null;

    const item = items[0];
    const gestorColumnId = GESTOR_RH_COLUMN[controlBoardId];
    const gestorColumn = item.column_values.find((c) => c.id === gestorColumnId);

    if (!gestorColumn?.value) return null;

    try {
      const parsed = JSON.parse(gestorColumn.value);
      const personId = parsed?.personsAndTeams?.[0]?.id;
      if (!personId) return null;

      return await this.monday.getUserById(String(personId));
    } catch {
      return null;
    }
  }

  // ── Carrega a página de aprovação ─────────────────────────────────────
  async getApproval(jwtToken: string, actorIp?: string) {
    const payload = await this.auth.verifyEvaluationToken(jwtToken);

    const { data: approvalToken } = await this.supabase.db
      .from('approval_tokens')
      .select('*')
      .eq('id', payload.sub)
      .single();

    if (!approvalToken) throw new NotFoundException('Token de aprovação não encontrado.');
    if (approvalToken.status === 'approved') throw new UnauthorizedException('Esta aprovação já foi realizada.');
    if (approvalToken.status === 'expired') throw new UnauthorizedException('Este link de aprovação expirou.');
    if (new Date(approvalToken.expires_at) < new Date()) {
      await this.supabase.db.from('approval_tokens').update({ status: 'expired' }).eq('id', approvalToken.id);
      throw new UnauthorizedException('Este link de aprovação expirou.');
    }

    // Marca como aberto
    await this.supabase.db
      .from('approval_tokens')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', approvalToken.id)
      .eq('status', 'pending');

    // Busca a submissão
    const { data: submission } = await this.supabase.db
      .from('form_submissions')
      .select('*')
      .eq('token_id', approvalToken.evaluation_token_id)
      .single();

    // Busca o schema para mostrar os nomes das competências
    const { data: evalToken } = await this.supabase.db
      .from('evaluation_tokens')
      .select('*, function_schemas(*)')
      .eq('id', approvalToken.evaluation_token_id)
      .single();

    return {
      approval_token: approvalToken,
      submission,
      schema: evalToken?.function_schemas,
    };
  }

  // ── Submete a assinatura do RH ─────────────────────────────────────────
  async submitApproval(params: {
    approvalTokenId: string;
    approverName: string;
    signaturePngBase64: string;
    actorIp: string;
    actorAgent: string;
  }) {
    const { data: approvalToken } = await this.supabase.db
      .from('approval_tokens')
      .select('*')
      .eq('id', params.approvalTokenId)
      .single();

    if (!approvalToken) throw new NotFoundException('Token não encontrado.');
    if (approvalToken.status === 'approved') throw new UnauthorizedException('Já aprovado.');

    // Hash do documento
    const documentHash = createHash('sha256')
      .update(JSON.stringify({ approval_token_id: params.approvalTokenId, approver: params.approverName }))
      .digest('hex');

    // Salva assinatura no Supabase
    await this.signature.saveSignature({
      tokenId: approvalToken.evaluation_token_id,
      signerName: params.approverName,
      signerRole: 'coordinator',
      ipAddress: params.actorIp,
      userAgent: params.actorAgent,
      documentHash,
      pngBase64: params.signaturePngBase64,
    });

    // Upload para o Monday na coluna correta
    const signatureColumnId = RH_SIGNATURE_COLUMN[approvalToken.monday_board_id];

    const mondayFileId = await this.monday.uploadSignatureFile(
      approvalToken.monday_item_id,
      signatureColumnId,
      params.signaturePngBase64,
      `assinatura_rh_${approvalToken.collaborator_name.replace(/\s+/g, '_')}.png`,
    );

    // Atualiza o token de aprovação
    await this.supabase.db
      .from('approval_tokens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', params.approvalTokenId);

    await this.audit.log({
      tokenId: approvalToken.evaluation_token_id,
      tenantId: approvalToken.tenant_id,
      action: 'signature_captured',
      actorIp: params.actorIp,
      actorAgent: params.actorAgent,
      metadata: { signer_role: 'coordinator', monday_file_id: mondayFileId },
    });

    this.logger.log(`RH approval completed for ${approvalToken.collaborator_name}`);
    return { success: true };
  }
}