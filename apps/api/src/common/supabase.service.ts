import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private config: ConfigService) {
    this.client = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
      { auth: { persistSession: false } },
    );
  }

  get db(): SupabaseClient {
    return this.client;
  }
}
