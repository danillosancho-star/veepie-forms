import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
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

  // POST /forms/initiate
  // Chamado pelo Monday (webhook ou botão) para criar o link de avaliação
  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  initiate(@Body() body: InitiateEvaluationRequest, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    return this.forms.initiateEvaluation(body, ip);
  }

  // GET /forms?token=<jwt>
  // Chamado pelo frontend do avaliador ao abrir o link
  @Get()
  getForm(@Query('token') token: string, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    return this.forms.getForm(token, ip);
  }

  // POST /forms/submit
  // Chamado pelo frontend ao submeter o formulário com assinatura
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(@Body() body: SubmitFormRequest, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const agent = req.headers['user-agent'] ?? '';
    return this.forms.submitForm(body, ip, agent);
  }
}
