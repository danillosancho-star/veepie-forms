import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  supabaseConfig,
  jwtConfig,
  cryptoConfig,
  mondayConfig,
  emailConfig,
} from './config';
import { SupabaseService } from './common/supabase.service';
import { AuthModule } from './modules/auth/auth.module';
import { FormsController } from './modules/forms/forms.controller';
import { FormsService } from './modules/forms/forms.service';
import { ApprovalController } from './modules/forms/approval.controller';
import { ApprovalService } from './modules/forms/approval.service';
import { MondayService } from './modules/monday/monday.service';
import { SignatureService } from './modules/signature/signature.service';
import { AuditService } from './modules/audit/audit.service';
import { EmailService } from './modules/email/email.service';
import { WebhooksController } from './modules/webhooks/webhooks.controller';
import { SchedulerController } from './modules/scheduler/scheduler.controller';
import { SchedulerService } from './modules/scheduler/scheduler.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, supabaseConfig, jwtConfig, cryptoConfig, mondayConfig, emailConfig],
    }),
    AuthModule,
  ],
  controllers: [
    FormsController,
    ApprovalController,
    WebhooksController,
    SchedulerController,
  ],
  providers: [
    SupabaseService,
    FormsService,
    ApprovalService,
    MondayService,
    SignatureService,
    AuditService,
    EmailService,
    SchedulerService,
  ],
})
export class AppModule {}