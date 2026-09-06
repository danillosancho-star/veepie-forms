# Veepie Forms \u2014 Admin API

Servi\u00e7o NestJS **isolado** para o painel de administra\u00e7\u00e3o das matrizes de compet\u00eancia.
N\u00e3o toca o backend de produ\u00e7\u00e3o. Mexe apenas nas tabelas novas do admin
(`schema_drafts`, `schema_versions`, `available_competencies`, `tenant_admins`)
e, somente ao **publicar**, atualiza `function_schemas` \u2014 o mesmo UPDATE que
hoje \u00e9 feito manualmente via SQL.

## Rodar local

```bash
cp .env.example .env      # preencha SUPABASE_SERVICE_ROLE_KEY
npm install
npm run start:dev
```

API em `http://localhost:3002/api/v1`.

## Endpoints (todos exigem Bearer token do Supabase Auth)

| M\u00e9todo | Rota | Descri\u00e7\u00e3o |
|--------|------|-----------|
| GET  | /admin/me | Admin logado + tenant |
| GET  | /admin/competencies | Pool de compet\u00eancias dispon\u00edveis |
| GET  | /admin/schemas | Cargos ao vivo (produ\u00e7\u00e3o) |
| GET  | /admin/schemas/:id | Um cargo |
| GET  | /admin/schemas/:id/versions | Hist\u00f3rico de vers\u00f5es |
| GET  | /admin/drafts | Rascunhos abertos |
| POST | /admin/drafts | Cria rascunho (create/update/delete) |
| POST | /admin/drafts/from-schema/:schemaId | Edita cargo ao vivo (copia p/ rascunho) |
| PUT  | /admin/drafts/:id | Atualiza rascunho |
| DELETE | /admin/drafts/:id | Descarta rascunho |
| POST | /admin/drafts/:id/publish | **Publica** (altera produ\u00e7\u00e3o) |
| POST | /admin/drafts/restore/:versionId | Restaura vers\u00e3o antiga como rascunho |

## Deploy (Railway)

- Novo servi\u00e7o, root directory `apps/admin-api`
- Build: `npm install && npm run build`
- Start: `node dist/main.js`
- Vari\u00e1veis: PORT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_WEB_URL
