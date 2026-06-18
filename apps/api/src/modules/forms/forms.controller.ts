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
}