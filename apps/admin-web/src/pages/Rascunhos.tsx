import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { COLORS } from '../lib/constants';

const OP_LABEL: Record<string, string> = { create: 'Novo cargo', update: 'Alteração', delete: 'Exclusão' };
const OP_COLOR: Record<string, string> = { create: '#059669', update: '#0D3B7A', delete: '#dc2626' };

export default function Rascunhos() {
  const nav = useNavigate();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    setDrafts(await api.drafts());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const publish = async (d: any) => {
    if (!confirm(`Publicar "${d.title}" (${OP_LABEL[d.operation]})?`)) return;
    setBusy(d.id);
    try { await api.publishDraft(d.id); await load(); }
    catch (e: any) { alert(e.message); }
    setBusy('');
  };

  const discard = async (d: any) => {
    if (!confirm('Descartar este rascunho?')) return;
    setBusy(d.id);
    try { await api.discardDraft(d.id); await load(); }
    catch (e: any) { alert(e.message); }
    setBusy('');
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginTop: 0, color: '#111' }}>Rascunhos</h1>
      <p style={{ color: COLORS.gray, fontSize: 14, marginTop: 0 }}>Alterações pendentes. Nada aqui está no ar até ser publicado.</p>

      {drafts.length === 0 && <div style={{ color: COLORS.gray, fontSize: 14, marginTop: 24 }}>Nenhum rascunho aberto.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {drafts.map((d) => (
          <div key={d.id} style={{ background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: OP_COLOR[d.operation], padding: '2px 8px', borderRadius: 10 }}>{OP_LABEL[d.operation]}</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{d.title}</span>
              </div>
              <div style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>{(d.competencies?.length ?? 0)} competências</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {d.operation !== 'delete' && <button onClick={() => nav(`/editor/${d.id}`)} style={btnGhost}>Editar</button>}
              <button onClick={() => discard(d)} disabled={busy === d.id} style={btnGhost}>Descartar</button>
              <button onClick={() => publish(d)} disabled={busy === d.id} style={btnPublish}>{busy === d.id ? '...' : 'Publicar'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnGhost: React.CSSProperties = { background: 'white', color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' };
const btnPublish: React.CSSProperties = { background: COLORS.green, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
