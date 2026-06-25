import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(
    private scheduler: SchedulerService,
    private config: ConfigService,
  ) {}

  @Post('run-monthly')
  @HttpCode(HttpStatus.OK)
  async runMonthly(@Headers('x-scheduler-secret') secret: string) {
    const expectedSecret = this.config.get<string>('app.schedulerSecret');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid scheduler secret.');
    }
    return this.scheduler.runMonthlyEvaluations();
  }
}