import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SupabaseService } from '../../common/supabase.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { issuer: 'veepie-forms' },
      }),
    }),
  ],
  providers: [AuthService, SupabaseService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
