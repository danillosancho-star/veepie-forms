import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FormsService } from './forms.service';
import type {
  InitiateEvaluationRequest,
  SubmitFormRequest,
} from '@veepie-forms/shared';

@Controller('forms')
export class FormsController {
  constructor(private forms: FormsService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  initiate(@Body() body: InitiateEvaluationRequest, @Req() req: Request) {
    const rawIp = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const ip = rawIp.split(',')[0].trim();
    return this.forms.initiateEvaluation(body, ip);
  }

  @Get()
  getForm(@Query('token') token: string, @Req() req: Request) {
    const rawIp = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const ip = rawIp.split(',')[0].trim();
    return this.forms.getForm(token, ip);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(@Body() body: SubmitFormRequest, @Req() req: Request) {
    const rawIp = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const ip = rawIp.split(',')[0].trim();
    const agent = req.headers['user-agent'] ?? '';
    return this.forms.submitForm(body, ip, agent);
  }

  // ──────────────────────────────────────────────────────────────────
  // Endpoints de manutenção (reprocesso). Protegidos por header
  // x-admin-secret == process.env.ADMIN_RESYNC_SECRET.
  // ──────────────────────────────────────────────────────────────────

  @Get('resync-candidates')
  resyncCandidates(@Headers('x-admin-secret') secret: string) {
    this.assertAdmin(secret);
    return this.forms.listResyncCandidates();
  }

  @Post('resync/:tokenId')
  @HttpCode(HttpStatus.OK)
  resync(
    @Param('tokenId') tokenId: string,
    @Query('force') force: string,
    @Query('dryRun') dryRun: string,
    @Headers('x-admin-secret') secret: string,
    @Req() req: Request,
  ) {
    this.assertAdmin(secret);
    const rawIp = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const ip = rawIp.split(',')[0].trim() || 'resync';
    return this.forms.resyncToMonday(tokenId, ip, {
      force: force === 'true' || force === '1',
      dryRun: dryRun === 'true' || dryRun === '1',
    });
  }

  private assertAdmin(secret: string) {
    const expected = process.env.ADMIN_RESYNC_SECRET;
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Acesso negado.');
    }
  }
}
