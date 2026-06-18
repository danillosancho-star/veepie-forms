import { Module } from '@nestjs/common';
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
import { MondayService } from './modules/monday/monday.service';
import { SignatureService } from './modules/signature/signature.service';
import { AuditService } from './modules/audit/audit.service';
import { EmailService } from './modules/email/email.service';
import { WebhooksController } from './modules/webhooks/webhooks.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, supabaseConfig, jwtConfig, cryptoConfig, mondayConfig, emailConfig],
    }),
    AuthModule,
  ],
  controllers: [FormsController, WebhooksController],
  providers: [
    SupabaseService,
    FormsService,
    MondayService,
    SignatureService,
    AuditService,
    EmailService,
  ],
})
export class AppModule {}