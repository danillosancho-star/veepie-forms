import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { COLORS } from '../lib/constants';

export default function Layout({ children }: { children: ReactNode }) {
  const { me, signOut } = useAuth();
  const loc = useLocation();

  const navItem = (to: string, label: string) => {
    const active = loc.pathname === to;
    return (
      <Link
        to={to}
        style={{
          textDecoration: 'none',
          color: active ? COLORS.navy : COLORS.gray,
          fontWeight: active ? 700 : 500,
          padding: '8px 14px',
          borderRadius: 8,
          background: active ? '#eaf0fb' : 'transparent',
          fontSize: 14,
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          background: 'white',
          borderBottom: `1px solid ${COLORS.border}`,
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src="/logo.png" alt="Veepie" style={{ height: 34 }} />
          <nav style={{ display: 'flex', gap: 6 }}>
            {navItem('/', 'Cargos')}
            {navItem('/rascunhos', 'Rascunhos')}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{me?.tenant?.name}</div>
            <div style={{ fontSize: 12, color: COLORS.gray }}>{me?.admin?.email}</div>
          </div>
          <button
            onClick={signOut}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: 'white',
              borderRadius: 8,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 13,
              color: COLORS.gray,
            }}
          >
            Sair
          </button>
        </div>
      </header>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>{children}</main>
    </div>
  );
}
