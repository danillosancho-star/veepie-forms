import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { Competency, DraftOperation } from '../../common/types';

interface DraftInput {
  function_schema_id?: string | null;
  external_id?: string;
  title: string;
  monday_function_value: string;
  competencies: Competency[];
  operation: DraftOperation;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class DraftsService {
  constructor(private supabase: SupabaseService) {}

  // Valida que toda competência vem do pool permitido (decisão "b")
  private async validateCompetencies(tenantId: string, comps: Competency[]) {
    const { data: pool } = await this.supabase.db
      .from('available_competencies')
      .select('monday_column_id')
      .eq('tenant_id', tenantId)
      .eq('active', true);

    const allowed = new Set((pool ?? []).map((p: any) => p.monday_column_id));
    for (const c of comps ?? []) {
      if (!c.monday_column_id || !allowed.has(c.monday_column_id)) {
        throw new BadRequestException(
          `A competência "${c.title ?? c.monday_column_id}" não está no catálogo disponível.`,
        );
      }
    }
  }

  // Gera um external_id único no tenant a partir do título FINAL do cargo.
  // Ex.: "Assistente Financeiro" -> assistente_financeiro (ou _2, _3... se já existir).
  // Chamado na publicação, para não herdar o "novo_cargo" do título provisório.
  private async uniqueExternalId(tenantId: string, title: string): Promise<string> {
    const base = slugify(title) || 'cargo';

    const { data } = await this.supabase.db
      .from('function_schemas')
      .select('external_id')
      .eq('tenant_id', tenantId)
      .like('external_id', `${base}%`);

    const taken = new Set((data ?? []).map((r: any) => r.external_id));
    if (!taken.has(base)) return base;

    let n = 2;
    while (taken.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
  }

  async list(tenantId: string) {
    const { data } = await this.supabase.db
      .from('schema_drafts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false });
    return data ?? [];
  }

  async getOne(tenantId: string, id: string) {
    const { data } = await this.supabase.db
      .from('schema_drafts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();
    if (!data) throw new NotFoundException('Rascunho não encontrado.');
    return data;
  }

  async create(tenantId: string, adminId: string, input: DraftInput) {
    if (input.operation !== 'delete') {
      await this.validateCompetencies(tenantId, input.competencies);
    }

    // Para cargos novos este valor é provisório: o definitivo é gerado na publicação.
    const external_id = input.external_id || slugify(input.title);

    const { data, error } = await this.supabase.db
      .from('schema_drafts')
      .insert({
        tenant_id: tenantId,
        function_schema_id: input.function_schema_id ?? null,
        external_id,
        title: input.title,
        monday_function_value: input.monday_function_value,
        competencies: input.competencies ?? [],
        operation: input.operation,
        status: 'draft',
        created_by: adminId,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // Começa a editar um cargo AO VIVO → cria um rascunho copiando o estado atual
  async createFromSchema(tenantId: string, adminId: string, schemaId: string) {
    const { data: schema } = await this.supabase.db
      .from('function_schemas')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', schemaId)
      .single();
    if (!schema) throw new NotFoundException('Cargo não encontrado.');

    return this.create(tenantId, adminId, {
      function_schema_id: schema.id,
      external_id: schema.external_id,
      title: schema.title,
      monday_function_value: schema.monday_function_value,
      competencies: schema.competencies,
      operation: 'update',
    });
  }

  async update(tenantId: string, id: string, input: Partial<DraftInput>) {
    const draft = await this.getOne(tenantId, id);
    if (draft.status !== 'draft') {
      throw new BadRequestException('Somente rascunhos podem ser editados.');
    }
    if (input.competencies && draft.operation !== 'delete') {
      await this.validateCompetencies(tenantId, input.competencies as Competency[]);
    }

    const { data, error } = await this.supabase.db
      .from('schema_drafts')
      .update({
        title: input.title ?? draft.title,
        monday_function_value:
          input.monday_function_value ?? draft.monday_function_value,
        competencies: input.competencies ?? draft.competencies,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async discard(tenantId: string, id: string) {
    const draft = await this.getOne(tenantId, id);
    await this.supabase.db
      .from('schema_drafts')
      .update({ status: 'discarded' })
      .eq('id', draft.id);
    return { success: true };
  }

  private async nextVersion(schemaId: string): Promise<number> {
    const { data } = await this.supabase.db
      .from('schema_versions')
      .select('version_number')
      .eq('function_schema_id', schemaId)
      .order('version_number', { ascending: false })
      .limit(1);
    return ((data?.[0]?.version_number as number) ?? 0) + 1;
  }

  // ── PUBLICAR — o único ponto que altera produção ──────────────
  async publish(tenantId: string, adminId: string, id: string) {
    const draft = await this.getOne(tenantId, id);
    if (draft.status !== 'draft') {
      throw new BadRequestException('Este rascunho já foi publicado ou descartado.');
    }

    const db = this.supabase.db;

    // ── CRIAR novo cargo ──
    if (draft.operation === 'create') {
      await this.validateCompetencies(tenantId, draft.competencies);

      // Sem o cargo do Monday a matriz nunca seria usada pelas avaliações.
      if (!draft.monday_function_value || !String(draft.monday_function_value).trim()) {
        throw new BadRequestException(
          'Informe o cargo do Monday (exatamente como aparece na coluna Cargo do board) antes de publicar.',
        );
      }

      // Evita dois cargos ativos apontando para o mesmo valor de Cargo
      const { data: clash } = await db
        .from('function_schemas')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('monday_function_value', draft.monday_function_value)
        .eq('active', true)
        .maybeSingle();
      if (clash) {
        throw new BadRequestException(
          'Já existe um cargo ativo com esse valor de função do Monday.',
        );
      }

      // Identificador definitivo, gerado do título final e único no tenant
      const externalId = await this.uniqueExternalId(tenantId, draft.title);

      const { data: inserted, error } = await db
        .from('function_schemas')
        .insert({
          tenant_id: tenantId,
          external_id: externalId,
          title: draft.title,
          monday_function_value: draft.monday_function_value,
          competencies: draft.competencies,
          active: true,
        })
        .select()
        .single();
      if (error) {
        if ((error as any).code === '23505') {
          throw new BadRequestException(
            'Já existe um cargo com este identificador. Tente publicar novamente; se persistir, ajuste o nome do cargo.',
          );
        }
        throw new BadRequestException(error.message);
      }

      await db.from('schema_versions').insert({
        function_schema_id: inserted.id,
        tenant_id: tenantId,
        version_number: 1,
        title: inserted.title,
        monday_function_value: inserted.monday_function_value,
        competencies: inserted.competencies,
        published_by: adminId,
      });

      await db
        .from('schema_drafts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          function_schema_id: inserted.id,
          external_id: externalId,
        })
        .eq('id', draft.id);

      return { success: true, function_schema_id: inserted.id, operation: 'create' };
    }

    // ── ATUALIZAR cargo existente ──
    if (draft.operation === 'update') {
      await this.validateCompetencies(tenantId, draft.competencies);
      const schemaId = draft.function_schema_id;
      if (!schemaId) throw new BadRequestException('Rascunho sem cargo de referência.');

      const next = await this.nextVersion(schemaId);

      const { error } = await db
        .from('function_schemas')
        .update({
          title: draft.title,
          monday_function_value: draft.monday_function_value,
          competencies: draft.competencies,
        })
        .eq('id', schemaId)
        .eq('tenant_id', tenantId);
      if (error) throw new BadRequestException(error.message);

      await db.from('schema_versions').insert({
        function_schema_id: schemaId,
        tenant_id: tenantId,
        version_number: next,
        title: draft.title,
        monday_function_value: draft.monday_function_value,
        competencies: draft.competencies,
        published_by: adminId,
      });

      await db
        .from('schema_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draft.id);

      return { success: true, function_schema_id: schemaId, operation: 'update' };
    }

    // ── EXCLUIR (desativar) cargo ──
    if (draft.operation === 'delete') {
      const schemaId = draft.function_schema_id;
      if (!schemaId) throw new BadRequestException('Rascunho sem cargo de referência.');

      const { data: current } = await db
        .from('function_schemas')
        .select('*')
        .eq('id', schemaId)
        .single();

      if (current) {
        const next = await this.nextVersion(schemaId);
        await db.from('schema_versions').insert({
          function_schema_id: schemaId,
          tenant_id: tenantId,
          version_number: next,
          title: current.title,
          monday_function_value: current.monday_function_value,
          competencies: current.competencies,
          published_by: adminId,
        });
      }

      await db
        .from('function_schemas')
        .update({ active: false })
        .eq('id', schemaId)
        .eq('tenant_id', tenantId);

      await db
        .from('schema_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draft.id);

      return { success: true, function_schema_id: schemaId, operation: 'delete' };
    }

    throw new BadRequestException('Operação desconhecida.');
  }

  // Restaurar uma versão antiga → cria um rascunho (update) para revisão
  async restoreVersion(tenantId: string, adminId: string, versionId: string) {
    const { data: version } = await this.supabase.db
      .from('schema_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', versionId)
      .single();
    if (!version) throw new NotFoundException('Versão não encontrada.');

    return this.create(tenantId, adminId, {
      function_schema_id: version.function_schema_id,
      title: version.title,
      monday_function_value: version.monday_function_value,
      competencies: version.competencies,
      operation: 'update',
    });
  }
}
