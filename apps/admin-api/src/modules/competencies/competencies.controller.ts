import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { AdminAuthGuard } from '../../common/admin-auth.guard';

@Controller('admin/competencies')
@UseGuards(AdminAuthGuard)
export class CompetenciesController {
  constructor(private supabase: SupabaseService) {}

  // Pool de compet\u00eancias dispon\u00edveis (decis\u00e3o "b" \u2014 escolher daqui)
  @Get()
  async list(@Req() req: any) {
    const { data } = await this.supabase.db
      .from('available_competencies')
      .select('id, monday_column_id, default_title')
      .eq('tenant_id', req.admin.tenantId)
      .eq('active', true)
      .order('default_title');

    return data ?? [];
  }
}
