import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase.service';
import { TOKEN_EXPIRY_HOURS_DEFAULT } from '@veepie-forms/shared';

export interface TokenPayload {
  sub: string;        // token_id (UUID)
  tenant: string;     // tenant slug
  item: string;       // monday_item_id
}

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private supabase: SupabaseService,
  ) {}

  signEvaluationToken(payload: TokenPayload, expiresInHours?: number): string {
    const hours = expiresInHours ?? TOKEN_EXPIRY_HOURS_DEFAULT;
    return this.jwt.sign(payload, { expiresIn: `${hours}h` });
  }

  async verifyEvaluationToken(token: string): Promise<TokenPayload> {
    try {
      return this.jwt.verify<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  async validateTokenRecord(tokenId: string) {
    const { data, error } = await this.supabase.db
      .from('evaluation_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Token não encontrado.');
    }

    if (data.status === 'expired') {
      throw new UnauthorizedException('Este link de avaliação expirou.');
    }

    if (data.status === 'submitted') {
      throw new UnauthorizedException('Esta avaliação já foi submetida.');
    }

    if (new Date(data.expires_at) < new Date()) {
      // expirar no banco também
      await this.supabase.db
        .from('evaluation_tokens')
        .update({ status: 'expired' })
        .eq('id', tokenId);
      throw new UnauthorizedException('Este link de avaliação expirou.');
    }

    return data;
  }

  async markTokenOpened(tokenId: string) {
    await this.supabase.db
      .from('evaluation_tokens')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', tokenId)
      .eq('status', 'pending'); // só atualiza se ainda estava pending
  }
}
