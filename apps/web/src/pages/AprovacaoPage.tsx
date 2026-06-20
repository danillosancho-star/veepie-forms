import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { formsApi } from '../services/api';

type Step = 'loading' | 'review' | 'signature' | 'success' | 'error';

export default function AprovacaoPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [step, setStep] = useState<Step>('loading');
  const [approverName, setApproverName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const sigCanvas = useRef<SignatureCanvas>(null);

  const { data, isError, error } = useQuery({
    queryKey: ['approval', token],
    queryFn: () => formsApi.getApproval(token),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setApproverName(data.approval_token?.approver_name ?? '');
      setStep('review');
    }
    if (isError) {
      const msg = (error as any)?.response?.data?.message ?? 'Link inválido ou expirado.';
      setErrorMsg(msg);
      setStep('error');
    }
  }, [data, isError, error]);

  const submit = useMutation({
    mutationFn: formsApi.submitApproval,
    onSuccess: () => setStep('success'),
    onError: () => setStep('error'),
  });

  const handleSubmit = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('Por favor, assine antes de enviar.');
      return;
    }
    const pngBase64 = sigCanvas.current.toDataURL('image/png').split(',')[1];
    submit.mutate({
      approval_token_id: data!.approval_token.id,
      approver_name: approverName,
      signature_png_base64: pngBase64,
    });
  };

  const approval = data?.approval_token;
  const submission = data?.submission;
  const schema = data?.schema;

  if (step === 'loading') {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.muted}>Carregando avaliação...</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={styles.center}>
        <div style={styles.errorBox}>
          <h2 style={styles.errorTitle}>Link inválido ou expirado</h2>
          <p style={styles.muted}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div style={styles.center}>
        <div style={styles.successBox}>
          <div style={styles.checkmark}>✓</div>
          <h2 style={styles.successTitle}>Avaliação aprovada!</h2>
          <p style={styles.muted}>Sua assinatura foi registrada com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.badge}>Aprovação — Gestor RH</div>
          <h1 style={styles.title}>{approval?.collaborator_name}</h1>
          <p style={styles.subtitle}>
            Avaliado por: <strong>{submission?.evaluator_name}</strong>
          </p>
        </div>

        {step === 'review' && (
          <>
            {schema?.competencies?.length > 0 && (
              <div style={styles.card}>
                <div style={styles.compTitle}>Resumo das competências avaliadas</div>
                <div style={{ marginTop: 12 }}>
                  {schema.competencies.map((comp: any) => {
                    const answer = submission?.answers?.find(
                      (a: any) => a.competency_id === comp.id,
                    );
                    return (
                      <div key={comp.id} style={styles.compRow}>
                        <span style={styles.compName}>{comp.title}</span>
                        <span style={styles.compScore}>
                          {answer ? `${answer.value} — ${answer.label.replace(/^\d+ – /, '')}` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {submission?.improvement_notes && (
              <div style={styles.card}>
                <div style={styles.compTitle}>Pontos de Melhoria e/ou Elogios</div>
                <p style={styles.noteText}>{submission.improvement_notes}</p>
              </div>
            )}

            {submission?.training_needs && (
              <div style={styles.card}>
                <div style={styles.compTitle}>Necessidades de Treinamento</div>
                <p style={styles.noteText}>{submission.training_needs}</p>
              </div>
            )}

            <button onClick={() => setStep('signature')} style={styles.btnPrimary}>
              Continuar para assinatura →
            </button>
          </>
        )}

        {step === 'signature' && (
          <>
            <div style={styles.card}>
              <div style={styles.compTitle}>Nome do Gestor RH</div>
              <input
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                style={styles.input}
                placeholder="Seu nome completo"
              />
            </div>

            <div style={styles.card}>
              <div style={styles.compTitle}>Assinatura</div>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
                Assine com o dedo ou mouse na área abaixo para aprovar esta avaliação.
              </p>
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
              <button onClick={() => setStep('review')} style={styles.btnSecondary}>
                ← Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submit.isPending || !approverName}
                style={{ ...styles.btnPrimary, background: '#059669' }}
              >
                {submit.isPending ? 'Enviando...' : 'Aprovar e assinar ✓'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' },
  container: { maxWidth: 680, margin: '0 auto' },
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { marginBottom: 32, textAlign: 'center' },
  badge: { display: 'inline-block', background: '#d1fae5', color: '#065f46', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 700, color: '#111', margin: '0 0 4px' },
  subtitle: { fontSize: 15, color: '#6b7280', margin: 0 },
  card: { background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #e5e7eb' },
  compTitle: { fontWeight: 600, fontSize: 15, color: '#111', marginBottom: 6 },
  compRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' },
  compName: { fontSize: 14, color: '#374151', flex: 1 },
  compScore: { fontSize: 13, color: '#4f46e5', fontWeight: 600, marginLeft: 12 },
  noteText: { fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 },
  input: { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' },
  sigWrapper: { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  sigCanvas: { width: '100%', height: 200, display: 'block' },
  btnClear: { fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  btnPrimary: { flex: 1, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { flex: 0, background: 'none', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 20px', fontSize: 15, cursor: 'pointer' },
  row: { display: 'flex', gap: 12 },
  spinner: { width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 },
  muted: { color: '#6b7280', fontSize: 15, textAlign: 'center' },
  errorBox: { background: 'white', borderRadius: 12, padding: 32, maxWidth: 400, textAlign: 'center', border: '1px solid #fecaca' },
  errorTitle: { color: '#dc2626', marginBottom: 12 },
  successBox: { background: 'white', borderRadius: 12, padding: 40, maxWidth: 400, textAlign: 'center', border: '1px solid #d1fae5' },
  checkmark: { width: 64, height: 64, background: '#059669', borderRadius: '50%', color: 'white', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  successTitle: { color: '#065f46', marginBottom: 12 },
};