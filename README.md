# Veepie Forms

Plataforma de formulários externos para stakeholders sem acesso ao Monday.com, com assinatura digital e integração automática com boards.

## Estrutura

```
veepie-forms/
├── apps/
│   ├── api/          NestJS — backend
│   └── web/          React + Vite — frontend do avaliador
├── packages/
│   └── shared/       Tipos TypeScript compartilhados
├── supabase/
│   └── 001_initial_schema.sql
├── Dockerfile.api
└── .env.example
```

## Setup local

### 1. Pré-requisitos
- Node 20+
- Conta Supabase (gratuita)
- Conta Resend (gratuita até 3k e-mails/mês)
- Token de serviço do Monday.com (usuário de integração)

### 2. Variáveis de ambiente

```bash
cp .env.example .env
# Preencha todos os valores no .env
```

Gere o JWT_SECRET:
```bash
openssl rand -base64 64
```

Gere o ENCRYPTION_KEY:
```bash
openssl rand -hex 32
```

### 3. Banco de dados (Supabase)

1. Crie um projeto em https://supabase.com
2. Abra o SQL Editor
3. Execute o conteúdo de `supabase/001_initial_schema.sql`
4. Copie a `service_role` key (não a `anon` key) para `SUPABASE_SERVICE_ROLE_KEY`

### 4. Instalar dependências

```bash
npm install
```

### 5. Rodar em desenvolvimento

```bash
# Terminal 1 — backend
npm run dev:api

# Terminal 2 — frontend
npm run dev:web
```

- API: http://localhost:3001/api/v1
- Web: http://localhost:5173

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/forms/initiate` | Cria token e envia e-mail para o avaliador |
| GET | `/api/v1/forms?token=<jwt>` | Carrega o formulário (usado pelo frontend) |
| POST | `/api/v1/forms/submit` | Submete respostas + assinatura |

### Exemplo: iniciar uma avaliação

```bash
curl -X POST http://localhost:3001/api/v1/forms/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<uuid-do-tenant>",
    "monday_item_id": "<id-do-item>",
    "evaluator_email": "avaliador@exemplo.com",
    "evaluator_name": "Dr. João Silva",
    "coordinator_email": "coord@exemplo.com",
    "expires_in_hours": 72
  }'
```

## Deploy

### Backend (Railway / Render)

```bash
# Build
docker build -f Dockerfile.api -t veepie-forms-api .

# Railway — via CLI
railway up
```

Variáveis de ambiente: configure todas as do `.env.example` no painel do Railway/Render.

### Frontend (Vercel)

```bash
cd apps/web
vercel deploy
```

Defina `VITE_API_URL` apontando para a URL do backend em produção.

## Popular os schemas de função (Vitalab)

Após rodar a migration, execute o seed de schemas via Supabase SQL Editor ou pela API de admin (a ser desenvolvida na Fase 4).

Os schemas das funções devem mapear:
- `external_id` — identificador interno
- `monday_function_value` — valor exato no dropdown de cargo do board
- `competencies` — array com `id`, `title`, `description`, `monday_column_id`, `required`

## Próximos passos (Fase 4+)

- [ ] Tela admin para cadastrar/editar schemas de função
- [ ] Automação Monday: botão no board dispara `POST /forms/initiate`
- [ ] Assinatura do coordenador (segundo fluxo via link ou widget Monday)
- [ ] Dashboard de acompanhamento (tokens pendentes, expirados, concluídos)
- [ ] Multi-tenant onboarding (cadastro de novos clientes via interface)
