import { useState } from 'react';
import { useAuth } from '../auth';
import { COLORS } from '../lib/constants';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setErr(e.message || 'Falha no login.');
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.png" alt="Veepie" style={{ height: 44 }} />
          <div style={{ marginTop: 12, color: COLORS.gray, fontSize: 14 }}>Painel de Administração</div>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600 }}>E-mail</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={inputStyle}
          placeholder="seu@email.com"
        />

        <label style={{ fontSize: 13, fontWeight: 600, marginTop: 14, display: 'block' }}>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={inputStyle}
          placeholder="********"
        />

        {err && <div style={{ color: COLORS.red, fontSize: 13, marginTop: 12 }}>{err}</div>}

        <button
          onClick={submit}
          disabled={busy || !email || !password}
          style={{
            marginTop: 22,
            width: '100%',
            background: COLORS.navy,
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '13px',
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy || !email || !password ? 0.6 : 1,
          }}
        >
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '11px 12px',
  fontSize: 14,
  marginTop: 6,
};
