import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { formsApi } from '../services/api';
import type { CompetencyAnswer, FunctionSchema } from '@veepie-forms/shared';
import { COMPETENCY_OPTIONS } from '@veepie-forms/shared';

type Step = 'loading' | 'form' | 'signature' | 'success' | 'error';

export default function AvaliacaoPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [step, setStep] = useState<Step>('loading');
  const [answers, setAnswers] = useState<Record<string, CompetencyAnswer>>({});
  const [improvementNotes, setImprovementNotes] = useState('');
  const [trainingNeeds, setTrainingNeeds] = useState('');
  const [evaluatorName, setEvaluatorName] = useState('');
  const sigCanvas = useRef<SignatureCanvas>(null);

  const { data, isError } = useQuery({
    queryKey: ['form', token],
    queryFn: () => formsApi.getForm(token),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setEvaluatorName(data.token?.evaluator_name ?? '');
      setStep('form');
    }
    if (isError) setStep('error');
  }, [data, isError]);

  const submit = useMutation({
    mutationFn: formsApi.submit,
    onSuccess: () => setStep('success'),
    onError: () => setStep('error'),
  });

  const handleAnswer = (competencyId: string, mondayColumnId: string, value: number) => {
    const option = COMPETENCY_OPTIONS.find((o) => o.value === value)!;
    setAnswers((prev) => ({
      ...prev,
      [competencyId]: { competency_id: competencyId, monday_column_id: mondayColumnId, value, label: option.label },
    }));
  };

  const handleSubmit = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('Por favor, assine o formulário antes de enviar.');
      return;
    }
    const pngBase64 = sigCanvas.current.toDataURL('image/png').split(',')[1];
    submit.mutate({
      token_id: data!.token.id,
      answers: Object.values(answers),
      improvement_notes: improvementNotes,
      training_needs: trainingNeeds,
      evaluator_name: evaluatorName,
      signature_png_base64: pngBase64,
    });
  };

  const schema: FunctionSchema | undefined = data?.schema;

  // ─── Loading ───────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.muted}>Carregando formulário...</p>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div style={styles.center}>
        <div style={styles.errorBox}>
          <h2 style={styles.errorTitle}>Link inválido ou expirado</h2>
          <p style={styles.muted}>
            Este link de avaliação não é mais válido. Entre em contato com o coordenador
            para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  // ─── Success ───────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={styles.center}>
        <div style={styles.successBox}>
          <div style={styles.checkmark}>✓</div>
          <h2 style={styles.successTitle}>Avaliação enviada!</h2>
          <p style={styles.muted}>
            O formulário foi assinado e enviado com sucesso. O coordenador será notificado.
          </p>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>Avaliação de Competências</div>
          <h1 style={styles.title}>{data?.collaborator_name}</h1>
          <p style={styles.subtitle}>{schema?.title}</p>
        </div>

        {/* Etapas */}
        <div style={styles.steps}>
          <StepPill active={step === 'form'} done={step === 'signature'} n={1} label="Competências" />
          <div style={styles.stepLine} />
          <StepPill active={step === 'signature'} done={false} n={2} label="Assinatura" />
        </div>

        {/* Step 1: Formulário de competências */}
        {step === 'form' && (
          <>
            {schema?.competencies.map((comp) => (
              <div key={comp.id} style={styles.card}>
                <div style={styles.compTitle}>{comp.title}</div>
                <p style={styles.compDesc}>{comp.description}</p>
                <div style={styles.options}>
                  {COMPETENCY_OPTIONS.map((opt) => {
                    const selected = answers[comp.id]?.value === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswer(comp.id, comp.monday_column_id, opt.value)}
                        style={{ ...styles.optBtn, ...(selected ? styles.optBtnActive : {}) }}
                      >
                        <span style={styles.optValue}>{opt.value}</span>
                        <span style={styles.optLabel}>{opt.label.replace(/^\d+ – /, '')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Campos de texto */}
            <div style={styles.card}>
              <label style={styles.compTitle}>Pontos de Melhoria e/ou Elogios</label>
              <textarea
                value={improvementNotes}
                onChange={(e) => setImprovementNotes(e.target.value)}
                style={styles.textarea}
                rows={4}
                placeholder="Descreva pontos de melhoria ou elogios relevantes..."
              />
            </div>

            <div style={styles.card}>
              <label style={styles.compTitle}>Levantamento de Necessidades de Treinamento</label>
              <textarea
                value={trainingNeeds}
                onChange={(e) => setTrainingNeeds(e.target.value)}
                style={styles.textarea}
                rows={4}
                placeholder="Indique necessidades de treinamento identificadas..."
              />
            </div>

            <button
              onClick={() => setStep('signature')}
              disabled={schema ? Object.keys(answers).length < schema.competencies.filter((c) => c.required).length : true}
              style={styles.btnPrimary}
            >
              Continuar para assinatura →
            </button>
          </>
        )}

        {/* Step 2: Assinatura */}
        {step === 'signature' && (
          <>
            <div style={styles.card}>
              <div style={styles.compTitle}>Nome do avaliador</div>
              <input
                value={evaluatorName}
                onChange={(e) => setEvaluatorName(e.target.value)}
                style={styles.input}
                placeholder="Seu nome completo"
              />
            </div>

            <div style={styles.card}>
              <div style={styles.compTitle}>Assinatura</div>
              <p style={styles.compDesc}>Assine com o dedo ou mouse na área abaixo.</p>
              <div style={styles.sigWrapper}>
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{ style: styles.sigCanvas }}
                  backgroundColor="white"
                />
              </div>
              <button onClick={() => sigCanvas.current?.clear()} style={styles.btnClear}>
                Limpar assinatura
              </button>
            </div>

            <div style={styles.row}>
              <button onClick={() => setStep('form')} style={styles.btnSecondary}>
                ← Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submit.isPending || !evaluatorName}
                style={styles.btnPrimary}
              >
                {submit.isPending ? 'Enviando...' : 'Enviar avaliação ✓'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepPill({ active, done, n, label }: { active: boolean; done: boolean; n: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done ? '#10b981' : active ? '#4f46e5' : '#e5e7eb',
        color: done || active ? 'white' : '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600, fontSize: 13,
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 14, color: active ? '#4f46e5' : '#6b7280', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Estilos inline ─────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' },
  container: { maxWidth: 680, margin: '0 auto' },
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { marginBottom: 32, textAlign: 'center' },
  badge: { display: 'inline-block', background: '#ede9fe', color: '#5b21b6', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 700, color: '#111', margin: '0 0 4px' },
  subtitle: { fontSize: 16, color: '#6b7280', margin: 0 },
  steps: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, justifyContent: 'center' },
  stepLine: { flex: 1, height: 1, background: '#e5e7eb', maxWidth: 60 },
  card: { background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #e5e7eb' },
  compTitle: { fontWeight: 600, fontSize: 15, color: '#111', marginBottom: 6 },
  compDesc: { fontSize: 14, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 },
  options: { display: 'flex', flexDirection: 'column', gap: 8 },
  optBtn: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', cursor: 'pointer', textAlign: 'left' },
  optBtnActive: { border: '2px solid #4f46e5', background: '#ede9fe' },
  optValue: { width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  optLabel: { fontSize: 14, color: '#374151' },
  textarea: { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  input: { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' },
  sigWrapper: { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  sigCanvas: { width: '100%', height: 200, display: 'block' },
  btnClear: { fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  btnPrimary: { flex: 1, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { flex: 0, background: 'none', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 20px', fontSize: 15, cursor: 'pointer' },
  row: { display: 'flex', gap: 12 },
  spinner: { width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 },
  muted: { color: '#6b7280', fontSize: 15, textAlign: 'center' },
  errorBox: { background: 'white', borderRadius: 12, padding: 32, maxWidth: 400, textAlign: 'center', border: '1px solid #fecaca' },
  errorTitle: { color: '#dc2626', marginBottom: 12 },
  successBox: { background: 'white', borderRadius: 12, padding: 40, maxWidth: 400, textAlign: 'center', border: '1px solid #d1fae5' },
  checkmark: { width: 64, height: 64, background: '#10b981', borderRadius: '50%', color: 'white', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  successTitle: { color: '#065f46', marginBottom: 12 },
};
