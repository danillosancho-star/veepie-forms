// ─────────────────────────────────────────────
// Tenant (cliente Veepie Forms)
// ─────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string; // ex: "vitalab"
  monday_board_id: string;
  monday_token_encrypted: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// Competência e schema de função
// ─────────────────────────────────────────────
export interface CompetencyOption {
  value: number; // 0–5
  label: string;
}

export interface Competency {
  id: string;           // ex: "PROCEDIMENTOS"
  title: string;
  description: string;  // critério específico para essa função
  monday_column_id: string;
  options: CompetencyOption[];
  required: boolean;
}

export interface FunctionSchema {
  id: string;           // ex: "farmaceutico_bioquimico"
  title: string;        // ex: "Farmacêutico Bioquímico"
  tenant_id: string;
  competencies: Competency[];
  monday_function_value: string; // valor exato no dropdown Monday
}

// ─────────────────────────────────────────────
// Token de avaliação (link único)
// ─────────────────────────────────────────────
export type TokenStatus = 'pending' | 'opened' | 'submitted' | 'expired';

export interface EvaluationToken {
  id: string;
  tenant_id: string;
  monday_item_id: string;   // ID do item (colaborador) no board
  monday_board_id: string;
  function_schema_id: string;
  collaborator_name: string;
  evaluator_email: string;
  evaluator_name: string;
  coordinator_email: string;
  status: TokenStatus;
  expires_at: string;       // ISO timestamp
  opened_at?: string;
  submitted_at?: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// Submissão do formulário
// ─────────────────────────────────────────────
export interface CompetencyAnswer {
  competency_id: string;
  monday_column_id: string;
  value: number;
  label: string;
}

export interface FormSubmission {
  token_id: string;
  answers: CompetencyAnswer[];
  improvement_notes: string;
  training_needs: string;
  evaluator_name: string;
  submitted_at: string;
}

// ─────────────────────────────────────────────
// Assinatura digital
// ─────────────────────────────────────────────
export interface SignatureRecord {
  id: string;
  token_id: string;
  signer_name: string;
  signer_role: 'evaluator' | 'coordinator';
  ip_address: string;
  user_agent: string;
  document_hash: string;  // SHA-256 do conteúdo do formulário
  png_base64: string;     // assinatura manuscrita
  signed_at: string;
}

// ─────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────
export type AuditAction =
  | 'token_created'
  | 'token_opened'
  | 'form_submitted'
  | 'signature_captured'
  | 'monday_updated'
  | 'coordinator_notified'
  | 'token_expired';

export interface AuditLog {
  id: string;
  token_id: string;
  tenant_id: string;
  action: AuditAction;
  actor_ip?: string;
  actor_agent?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─────────────────────────────────────────────
// API — request/response contracts
// ─────────────────────────────────────────────
export interface InitiateEvaluationRequest {
  tenant_id: string;
  monday_item_id: string;
  evaluator_email: string;
  evaluator_name: string;
  coordinator_email: string;
  expires_in_hours?: number; // default: 72
}

export interface InitiateEvaluationResponse {
  token_id: string;
  evaluation_url: string;
  expires_at: string;
}

export interface GetFormResponse {
  token: EvaluationToken;
  schema: FunctionSchema;
  collaborator_name: string;
}

export interface SubmitFormRequest {
  token_id: string;
  answers: CompetencyAnswer[];
  improvement_notes: string;
  training_needs: string;
  evaluator_name: string;
  signature_png_base64: string;
}

export interface SubmitFormResponse {
  success: boolean;
  submission_id: string;
  message: string;
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────
export const COMPETENCY_OPTIONS: CompetencyOption[] = [
  { value: 0, label: '0 – Não Aplicável' },
  { value: 1, label: '1 – Não Atende' },
  { value: 2, label: '2 – Atende Parcialmente' },
  { value: 3, label: '3 – Atende' },
  { value: 4, label: '4 – Acima do Esperado' },
  { value: 5, label: '5 – Muito Acima do Esperado' },
];

export const TOKEN_EXPIRY_HOURS_DEFAULT = 72;
