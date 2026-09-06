import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    const token = header.slice(7);
    const user = await this.supabase.getUserFromToken(token);
    if (!user) throw new UnauthorizedException('Sess\u00e3o inv\u00e1lida ou expirada.');

    const { data: admin } = await this.supabase.db
      .from('tenant_admins')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();

    if (!admin) {
      throw new UnauthorizedException('Usu\u00e1rio sem acesso ao painel.');
    }

    req.admin = {
      id: admin.id,
      tenantId: admin.tenant_id,
      role: admin.role,
      email: admin.email,
      name: admin.name,
    };
    return true;
  }
}
