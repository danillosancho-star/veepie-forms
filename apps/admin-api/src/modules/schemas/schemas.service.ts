import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';

@Injectable()
export class SchemasService {
  constructor(private supabase: SupabaseService) {}

  // Lista as matrizes AO VIVO (as que produ\u00e7\u00e3o usa)
  async list(tenantId: string) {
    const { data } = await this.supabase.db
      .from('function_schemas')
      .select('id, external_id, title, monday_function_value, competencies, active, updated_at')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('title');
    return data ?? [];
  }

  async getOne(tenantId: string, id: string) {
    const { data } = await this.supabase.db
      .from('function_schemas')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();
    if (!data) throw new NotFoundException('Cargo n\u00e3o encontrado.');
    return data;
  }

  // Hist\u00f3rico de vers\u00f5es publicadas de um cargo
  async listVersions(tenantId: string, schemaId: string) {
    const { data } = await this.supabase.db
      .from('schema_versions')
      .select('id, version_number, title, competencies, published_at, published_by')
      .eq('tenant_id', tenantId)
      .eq('function_schema_id', schemaId)
      .order('version_number', { ascending: false });
    return data ?? [];
  }
}
