import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { AuditAction } from '@veepie-forms/shared';

interface LogParams {
  tokenId?: string;
  tenantId?: string;
  action: AuditAction;
  actorIp?: string;
  actorAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private supabase: SupabaseService) {}

  async log(params: LogParams): Promise<void> {
    const { error } = await this.supabase.db.from('audit_logs').insert({
      token_id: params.tokenId,
      tenant_id: params.tenantId,
      action: params.action,
      actor_ip: params.actorIp,
      actor_agent: params.actorAgent,
      metadata: params.metadata,
    });

    if (error) {
      // Nunca deixar falha de audit quebrar o fluxo principal
      this.logger.error('Failed to write audit log', error);
    }
  }
}
