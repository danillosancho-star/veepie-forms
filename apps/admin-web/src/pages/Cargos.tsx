import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { COLORS } from '../lib/constants';

export default function Cargos() {
  const nav = useNavigate();
  const [schemas, setSchemas] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    const [s, d] = await Promise.all([api.schemas(), api.drafts()]);
    setSchemas(s);
    setDrafts(d);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const editCargo = async (schemaId: string) => {
    setBusy(schemaId);
    try {
      const draft = await api.draftFromSchema(schemaId);
      nav(`/editor/${draft.id}`);
    } catch (e: any) { alert(e.message); setBusy(''); }
  };

  const novoCargo = async () => {
    setBusy('new');
    try {
      const draft = await api.createDraft({
        title: 'Novo cargo',
        monday_function_value: '',
        competencies: [],
        operation: 'create',
      });
      nav(`/editor/${draft.id}`);
    } catch (e: any) { alert(e.message); setBusy(''); }
  };

  const excluirCargo = async (schema: any) => {
    if (!confirm(`Excluir o cargo "${schema.title}"? Ele deixará de aparecer nos formulários após a publicação. O histórico é preservado.`)) return;
    setBusy(schema.id);
    try {
      await api.createDraft({
        function_schema_id: schema.id,
        title: schema.title,
        monday_function_value: schema.monday_function_value,
        competencies: schema.competencies,
        operation: 'delete',
      });
      nav('/rascunhos');
    } catch (e: any) { alert(e.message); setBusy(''); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, margin: 0, color: '#111' }}>Cargos</h1>
        <button onClick={novoCargo} disabled={busy === 'new'} style={btnPrimary}>
          {busy === 'new' ? '...' : '+ Novo cargo'}
        </button>
      </div>
      <p style={{ color: COLORS.gray, fontSize: 14, marginTop: 0 }}>
        Matrizes de competência ativas. Alterações só entram no ar após publicar.
      </p>

      {drafts.length > 0 && (
        <div style={{ background: '#fff7e6', border: `1px solid ${COLORS.gold}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14 }}>
          Você tem <strong>{drafts.length}</strong> rascunho(s) não publicado(s).{' '}
          <span onClick={() => nav('/rascunhos')} style={{ color: COLORS.navy, fontWeight: 600, cursor: 'pointer' }}>Ver rascunhos &rarr;</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {schemas.map((s) => (
          <div key={s.id} style={card}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: COLORS.gray, marginTop: 2 }}>
                {(s.competencies?.length ?? 0)} competências · cargo Monday: {s.monday_function_value || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => nav(`/historico/${s.id}`)} style={btnGhost}>Histórico</button>
              <button onClick={() => editCargo(s.id)} disabled={busy === s.id} style={btnSecondary}>Editar</button>
              <button onClick={() => excluirCargo(s)} disabled={busy === s.id} style={btnDanger}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const btnPrimary: React.CSSProperties = { background: COLORS.navy, color: 'white', border: 'none', borderRadius: 9, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: 'white', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: 'white', color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { background: 'white', color: COLORS.red, border: `1px solid #f3c0c0`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' };
