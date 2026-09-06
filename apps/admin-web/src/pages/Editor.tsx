import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { COLORS, COMPETENCY_OPTIONS } from '../lib/constants';

export default function Editor() {
  const { draftId } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<any>(null);
  const [pool, setPool] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [mondayValue, setMondayValue] = useState('');
  const [comps, setComps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState('');

  useEffect(() => {
    (async () => {
      const [d, p] = await Promise.all([api.draft(draftId!), api.competencies()]);
      setDraft(d);
      setTitle(d.title);
      setMondayValue(d.monday_function_value || '');
      setPool(p);

      const existing = d.competencies || [];
      // Cargo novo e ainda vazio: já vem com TODAS as competências do catálogo
      // (descrição em branco, obrigatória). O RH remove o que não serve e escreve as descrições.
      if (d.operation === 'create' && existing.length === 0) {
        setComps(
          p.map((item: any) => ({
            id: item.monday_column_id,
            title: item.default_title,
            description: '',
            monday_column_id: item.monday_column_id,
            options: COMPETENCY_OPTIONS,
            required: true,
          })),
        );
      } else {
        setComps(existing);
      }
      setLoading(false);
    })();
  }, [draftId]);

  const usedIds = new Set(comps.map((c) => c.monday_column_id));
  const available = pool.filter((p) => !usedIds.has(p.monday_column_id));

  const addComp = (columnId: string) => {
    const p = pool.find((x) => x.monday_column_id === columnId);
    if (!p) return;
    setComps([...comps, {
      id: p.monday_column_id,
      title: p.default_title,
      description: '',
      monday_column_id: p.monday_column_id,
      options: COMPETENCY_OPTIONS,
      required: true,
    }]);
    setPicker('');
  };

  const removeComp = (columnId: string) => setComps(comps.filter((c) => c.monday_column_id !== columnId));
  const setDesc = (columnId: string, desc: string) =>
    setComps(comps.map((c) => (c.monday_column_id === columnId ? { ...c, description: desc } : c)));
  const toggleReq = (columnId: string) =>
    setComps(comps.map((c) => (c.monday_column_id === columnId ? { ...c, required: !c.required } : c)));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateDraft(draftId!, { title, monday_function_value: mondayValue, competencies: comps });
      alert('Rascunho salvo.');
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const publish = async () => {
    if (!mondayValue.trim()) { alert('Preencha o "Cargo no Monday" antes de publicar.'); return; }
    if (comps.length === 0) { alert('Adicione pelo menos uma competência.'); return; }
    if (!confirm('Publicar esta matriz? Ela passará a valer nos próximos formulários.')) return;
    setSaving(true);
    try {
      await api.updateDraft(draftId!, { title, monday_function_value: mondayValue, competencies: comps });
      await api.publishDraft(draftId!);
      alert('Publicado com sucesso!');
      nav('/');
    } catch (e: any) { alert(e.message); setSaving(false); }
  };

  if (loading) return <div className="spinner" />;

  const opLabel = draft.operation === 'create' ? 'Novo cargo' : 'Editando';

  return (
    <div>
      <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: COLORS.gray, cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12 }}>&larr; Voltar</button>

      <div style={{ display: 'inline-block', background: '#eaf0fb', color: COLORS.navy, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, marginBottom: 10 }}>{opLabel}</div>

      <div style={card}>
        <label style={lbl}>Nome do cargo</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} />

        <label style={{ ...lbl, marginTop: 14 }}>Cargo no Monday (texto exato da coluna Cargo)</label>
        <input value={mondayValue} onChange={(e) => setMondayValue(e.target.value.toUpperCase())} style={inp} placeholder="ex: FLEBOTOMISTA" />
        <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 6 }}>
          Deve corresponder exatamente ao valor da coluna Cargo no board, em maiúsculas.
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Competências ({comps.length})</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {comps.map((c) => (
          <div key={c.monday_column_id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
              <button onClick={() => removeComp(c.monday_column_id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 13 }}>Remover</button>
            </div>
            <textarea
              value={c.description}
              onChange={(e) => setDesc(c.monday_column_id, e.target.value)}
              placeholder="Descrição da competência para este cargo..."
              style={{ ...inp, marginTop: 8, minHeight: 60, resize: 'vertical' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: COLORS.gray }}>
              <input type="checkbox" checked={c.required} onChange={() => toggleReq(c.monday_column_id)} />
              Obrigatória
            </label>
          </div>
        ))}
      </div>

      <div style={card}>
        <label style={lbl}>Adicionar competência (do catálogo)</label>
        <select value={picker} onChange={(e) => addComp(e.target.value)} style={inp}>
          <option value="">Selecione...</option>
          {available.map((p) => (
            <option key={p.monday_column_id} value={p.monday_column_id}>{p.default_title}</option>
          ))}
        </select>
        {available.length === 0 && <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 6 }}>Todas as competências do catálogo já foram adicionadas.</div>}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ ...btnSecondary, flex: 1 }}>{saving ? '...' : 'Salvar rascunho'}</button>
        <button onClick={publish} disabled={saving} style={{ ...btnPublish, flex: 1 }}>{saving ? '...' : 'Publicar'}</button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: 'block' };
const inp: React.CSSProperties = { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, marginTop: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const btnPublish: React.CSSProperties = { background: COLORS.green, color: 'white', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
