import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
  apiUrl: process.env.API_URL ?? 'http://localhost:3001',
}));

export const supabaseConfig = registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET!,
  expiryDefault: process.env.JWT_EXPIRY_DEFAULT ?? '72h',
}));

export const cryptoConfig = registerAs('crypto', () => ({
  encryptionKey: process.env.ENCRYPTION_KEY!,
}));

export const mondayConfig = registerAs('monday', () => ({
  serviceToken: process.env.MONDAY_SERVICE_TOKEN!,
  apiUrl: 'https://api.monday.com/v2',
}));

export const emailConfig = registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY!,
  from: process.env.EMAIL_FROM ?? 'noreply@veepieforms.com.br',
  fromName: process.env.EMAIL_FROM_NAME ?? 'Veepie Forms',
}));
