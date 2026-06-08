import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../../common/supabase.service';
import { FormSubmission } from '@veepie-forms/shared';

@Injectable()
export class SignatureService {
  constructor(private supabase: SupabaseService) {}

  // Gera hash SHA-256 do conteúdo do formulário para integridade
  hashDocument(submission: FormSubmission): string {
    const content = JSON.stringify({
      token_id: submission.token_id,
      answers: submission.answers,
      improvement_notes: submission.improvement_notes,
      training_needs: submission.training_needs,
      evaluator_name: submission.evaluator_name,
      submitted_at: submission.submitted_at,
    });
    return createHash('sha256').update(content).digest('hex');
  }

  async saveSignature(params: {
    tokenId: string;
    signerName: string;
    signerRole: 'evaluator' | 'coordinator';
    ipAddress: string;
    userAgent: string;
    documentHash: string;
    pngBase64: string;
    mondayFileId?: string;
  }) {
    const { data, error } = await this.supabase.db
      .from('signature_records')
      .insert({
        token_id: params.tokenId,
        signer_name: params.signerName,
        signer_role: params.signerRole,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        document_hash: params.documentHash,
        png_base64: params.pngBase64,
        monday_file_id: params.mondayFileId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
