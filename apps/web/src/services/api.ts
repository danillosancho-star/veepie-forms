import axios from 'axios';
import type {
  GetFormResponse,
  SubmitFormRequest,
  SubmitFormResponse,
} from '@veepie-forms/shared';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export const formsApi = {
  getForm: (token: string): Promise<GetFormResponse> =>
    api.get(`/forms?token=${token}`).then((r) => r.data),

  submit: (body: SubmitFormRequest): Promise<SubmitFormResponse> =>
    api.post('/forms/submit', body).then((r) => r.data),

  getApproval: (token: string) =>
    api.get(`/approvals?token=${token}`).then((r) => r.data),

  submitApproval: (body: {
    approval_token_id: string;
    approver_name: string;
    signature_png_base64: string;
  }) => api.post('/approvals/submit', body).then((r) => r.data),
};