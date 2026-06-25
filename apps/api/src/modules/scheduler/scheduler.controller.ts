import {
  Controller,
  Post,
  Headers,
  Query,
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
  async runMonthly(
    @Headers('x-scheduler-secret') secret: string,
    @Query('month') month?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const expectedSecret = this.config.get<string>('app.schedulerSecret');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid scheduler secret.');
    }

    const targetMonth = month ? parseInt(month, 10) : undefined;
    const isDryRun = dryRun === 'true';

    return this.scheduler.runMonthlyEvaluations(targetMonth, isDryRun);
  }
}