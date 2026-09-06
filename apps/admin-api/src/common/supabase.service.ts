import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  public readonly db: SupabaseClient;

  constructor(private config: ConfigService) {
    this.db = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  // Valida o token do Supabase Auth e retorna o usu\u00e1rio
  async getUserFromToken(token: string) {
    const { data, error } = await this.db.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  }
}
