import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, supabaseConfig } from './config';
import { SupabaseService } from './common/supabase.service';
import { AuthController } from './modules/auth/auth.controller';
import { CompetenciesController } from './modules/competencies/competencies.controller';
import { SchemasController } from './modules/schemas/schemas.controller';
import { SchemasService } from './modules/schemas/schemas.service';
import { DraftsController } from './modules/drafts/drafts.controller';
import { DraftsService } from './modules/drafts/drafts.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, supabaseConfig],
    }),
  ],
  controllers: [
    AuthController,
    CompetenciesController,
    SchemasController,
    DraftsController,
  ],
  providers: [SupabaseService, SchemasService, DraftsService],
})
export class AppModule {}
