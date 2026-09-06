import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { DraftsService } from './drafts.service';

@Controller('admin/drafts')
@UseGuards(AdminAuthGuard)
export class DraftsController {
  constructor(private drafts: DraftsService) {}

  @Get()
  list(@Req() req: any) {
    return this.drafts.list(req.admin.tenantId);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.drafts.getOne(req.admin.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.drafts.create(req.admin.tenantId, req.admin.id, body);
  }

  // Come\u00e7a a editar um cargo ao vivo (copia para rascunho)
  @Post('from-schema/:schemaId')
  fromSchema(@Req() req: any, @Param('schemaId') schemaId: string) {
    return this.drafts.createFromSchema(req.admin.tenantId, req.admin.id, schemaId);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.drafts.update(req.admin.tenantId, id, body);
  }

  @Delete(':id')
  discard(@Req() req: any, @Param('id') id: string) {
    return this.drafts.discard(req.admin.tenantId, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Req() req: any, @Param('id') id: string) {
    return this.drafts.publish(req.admin.tenantId, req.admin.id, id);
  }

  @Post('restore/:versionId')
  restore(@Req() req: any, @Param('versionId') versionId: string) {
    return this.drafts.restoreVersion(req.admin.tenantId, req.admin.id, versionId);
  }
}
