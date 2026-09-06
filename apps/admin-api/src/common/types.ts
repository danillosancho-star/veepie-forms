// Tipos do admin (inline, para manter o serviço autocontido)

export interface CompetencyOption {
  value: number;
  label: string;
}

export interface Competency {
  id: string;
  title: string;
  description: string;
  monday_column_id: string;
  options: CompetencyOption[];
  required: boolean;
}

export const COMPETENCY_OPTIONS: CompetencyOption[] = [
  { value: 0, label: '0 \u2013 N\u00e3o Aplic\u00e1vel' },
  { value: 1, label: '1 \u2013 N\u00e3o Atende' },
  { value: 2, label: '2 \u2013 Atende Parcialmente' },
  { value: 3, label: '3 \u2013 Atende' },
  { value: 4, label: '4 \u2013 Acima do Esperado' },
  { value: 5, label: '5 \u2013 Muito Acima do Esperado' },
];

export type DraftOperation = 'create' | 'update' | 'delete';

export interface AdminContext {
  id: string;
  tenantId: string;
  role: string;
  email: string;
  name?: string;
}
