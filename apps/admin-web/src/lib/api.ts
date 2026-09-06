import { supabase } from './supabase';

const BASE = ((import.meta.env.VITE_ADMIN_API_URL as string) || 'http://localhost:3002') + '/api/v1';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function req(method: string, path: string, body?: any) {
  const headers = await authHeaders();
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me: () => req('GET', '/admin/me'),
  competencies: () => req('GET', '/admin/competencies'),
  schemas: () => req('GET', '/admin/schemas'),
  schema: (id: string) => req('GET', `/admin/schemas/${id}`),
  versions: (id: string) => req('GET', `/admin/schemas/${id}/versions`),
  drafts: () => req('GET', '/admin/drafts'),
  draft: (id: string) => req('GET', `/admin/drafts/${id}`),
  createDraft: (body: any) => req('POST', '/admin/drafts', body),
  draftFromSchema: (schemaId: string) => req('POST', `/admin/drafts/from-schema/${schemaId}`, {}),
  updateDraft: (id: string, body: any) => req('PUT', `/admin/drafts/${id}`, body),
  discardDraft: (id: string) => req('DELETE', `/admin/drafts/${id}`),
  publishDraft: (id: string) => req('POST', `/admin/drafts/${id}/publish`, {}),
  restoreVersion: (versionId: string) => req('POST', `/admin/drafts/restore/${versionId}`, {}),
};
