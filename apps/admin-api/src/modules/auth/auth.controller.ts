import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { AdminAuthGuard } from '../../common/admin-auth.guard';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AuthController {
  constructor(private supabase: SupabaseService) {}

  // Retorna o admin logado + o tenant a que ele pertence
  @Get('me')
  async me(@Req() req: any) {
    const { data: tenant } = await this.supabase.db
      .from('tenants')
      .select('id, name, slug')
      .eq('id', req.admin.tenantId)
      .single();

    return { admin: req.admin, tenant };
  }
}
