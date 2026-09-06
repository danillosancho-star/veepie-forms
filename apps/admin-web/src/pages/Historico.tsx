import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { COLORS } from '../lib/constants';

export default function Historico() {
  const { schemaId } = useParams();
  const nav = useNavigate();
  const [versions, setVersions] = useState<any[]>([]);
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    (async () => {
      const [v, s] = await Promise.all([api.versions(schemaId!), api.schema(schemaId!)]);
      setVersions(v);
      setSchema(s);
      setLoading(false);
    })();
  }, [schemaId]);

  const restore = async (versionId: string) => {
    if (!confirm('Restaurar esta versão? Ela será aberta como rascunho para você revisar e publicar.')) return;
    setBusy(versionId);
    try {
      const draft = await api.restoreVersion(versionId);
      nav(`/editor/${draft.id}`);
    } catch (e: any) { alert(e.message); setBusy(''); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: COLORS.gray, cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12 }}>&larr; Voltar</button>
      <h1 style={{ fontSize: 22, marginTop: 0, color: '#111' }}>Histórico &mdash; {schema?.title}</h1>
      <p style={{ color: COLORS.gray, fontSize: 14, marginTop: 0 }}>Versões publicadas. Restaurar abre a versão como rascunho.</p>

      {versions.length === 0 && <div style={{ color: COLORS.gray, fontSize: 14 }}>Nenhuma versão registrada ainda.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {versions.map((v) => (
          <div key={v.id} style={{ background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Versão {v.version_number}</div>
              <div style={{ fontSize: 13, color: COLORS.gray, marginTop: 2 }}>
                {(v.competencies?.length ?? 0)} competências · {new Date(v.published_at).toLocaleString('pt-BR')}
              </div>
            </div>
            <button onClick={() => restore(v.id)} disabled={busy === v.id} style={{ background: 'white', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {busy === v.id ? '...' : 'Restaurar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
