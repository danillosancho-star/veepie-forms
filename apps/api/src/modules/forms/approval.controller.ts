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
import { ApprovalService } from './approval.service';

@Controller('approvals')
export class ApprovalController {
  constructor(private approval: ApprovalService) {}

  @Get()
  getApproval(@Query('token') token: string, @Req() req: Request) {
    const rawIp = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const ip = rawIp.split(',')[0].trim();
    return this.approval.getApproval(token, ip);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submitApproval(
    @Body() body: {
      approval_token_id: string;
      approver_name: string;
      signature_png_base64: string;
    },
    @Req() req: Request,
  ) {
    const rawIp = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const ip = rawIp.split(',')[0].trim();
    const agent = req.headers['user-agent'] ?? '';
    return this.approval.submitApproval({
      approvalTokenId: body.approval_token_id,
      approverName: body.approver_name,
      signaturePngBase64: body.signature_png_base64,
      actorIp: ip,
      actorAgent: agent,
    });
  }
}