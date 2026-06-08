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
  // Carrega o formulário pelo token JWT da URL
  getForm: (token: string): Promise<GetFormResponse> =>
    api.get(`/forms?token=${token}`).then((r) => r.data),

  // Submete o formulário preenchido com a assinatura
  submit: (body: SubmitFormRequest): Promise<SubmitFormResponse> =>
    api.post('/forms/submit', body).then((r) => r.data),
};
