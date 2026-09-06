# Veepie Forms \u2014 Admin Web

Frontend do painel de administra\u00e7\u00e3o (React + Vite + Supabase Auth).

## Rodar local

```bash
cp .env.example .env   # j\u00e1 vem preenchido
npm install
npm run dev
```

Abre em http://localhost:5174 (o admin-api precisa estar rodando na 3002).

## Deploy (Vercel)

- Root directory: apps/admin-web
- Framework: Vite
- Vari\u00e1veis: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_API_URL
- Dom\u00ednio sugerido: admin.veepie.com
- Adicionar vercel.json com rewrite SPA (inclu\u00eddo).
