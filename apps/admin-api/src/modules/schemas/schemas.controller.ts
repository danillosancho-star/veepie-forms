import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { SchemasService } from './schemas.service';

@Controller('admin/schemas')
@UseGuards(AdminAuthGuard)
export class SchemasController {
  constructor(
    private schemas: SchemasService,
    private supabase: SupabaseService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.schemas.list(req.admin.tenantId);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.schemas.getOne(req.admin.tenantId, id);
  }

  @Get(':id/versions')
  versions(@Req() req: any, @Param('id') id: string) {
    return this.schemas.listVersions(req.admin.tenantId, id);
  }
}
