# Personal Organizer

PWA pessoal (instalável no celular/PC) pra organizar finanças mês a mês
(extrato de conta corrente + fatura de cartão, com categorização que "aprende"
sozinha) e a vida do apartamento (itens com nota fiscal/manual, projetos,
manutenção recorrente com calendário).

## Stack

- Frontend: Vite + React + TypeScript
- PWA: `vite-plugin-pwa` (Workbox)
- Banco/Auth/Storage: Supabase (Postgres + Auth + Storage)
- Cache/dados no cliente: `@tanstack/react-query` direto sobre o Supabase (sem cache offline local)
- Leitura de PDF: `pdfjs-dist` (extração de texto no navegador)
- Gráficos: `recharts` (carregado sob demanda, só na tela Resumo Geral)
- Hospedagem: GitHub Pages (deploy automático via GitHub Actions)

## 1. Configurar o Supabase

O projeto já existe (`sjhvnhfwajacpqpwogks`) com todo o schema aplicado
(`supabase/migrations`). Falta só:

1. Em **Authentication → Settings**, confirme que **"Enable email signups"**
   está desligado — o app não tem tela de cadastro, é uso pessoal, e a chave
   `anon` fica pública no bundle publicado no GitHub Pages.
2. Seu usuário de login já foi criado em **Authentication → Users**.

## 2. Rodar localmente

```bash
npm install --legacy-peer-deps
cp .env.example .env
# edite .env com a Project URL e a anon key (Project Settings → API)
npm run dev
```

Acesse `http://localhost:5173` e faça login com o usuário criado no passo 1.

> `--legacy-peer-deps` é necessário por um bug conhecido do npm 10 ao resolver
> os peer deps do Vitest 4 — não é nada específico deste projeto.

## 3. Publicar no GitHub Pages

O workflow `.github/workflows/deploy.yml` builda e publica automaticamente a
cada push na branch de desenvolvimento. Antes do primeiro deploy:

1. Em **Settings → Secrets and variables → Actions** do repositório, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Em **Settings → Pages**, mude **Source** para "GitHub Actions".

O app fica em `https://<seu-usuario>.github.io/personal-organizer/`.

## Importação de extrato/fatura (PDF)

A leitura do PDF é heurística — layout de banco varia muito — então toda
importação passa por uma tela de revisão antes de salvar qualquer coisa. Ao
categorizar um lançamento na revisão, a escolha fica salva no "banco de
lançamentos" (Settings → Banco de Lançamentos): da próxima vez que aparecer
uma descrição parecida, a categoria já vem preenchida sozinha.

## Estrutura de pastas

```
src/
  auth/            AuthContext (login por email/senha)
  components/      componentes de UI reutilizáveis (modal, diálogos, toasts, calendário...)
  hooks/           acesso a dados (Supabase + react-query), um arquivo por entidade
  lib/             lógica pura testável (parser de extrato, normalização, storage, datas)
  pages/
    financas/      extrato, fatura, resumos, importação
    apartamento/   itens, projetos, manutenção
    settings/      categorias, contas, banco de lançamentos, classificações
  styles/          CSS puro, um arquivo por área
supabase/
  migrations/      schema versionado (aplicado também direto no projeto via MCP)
```

## Testes

```bash
npm test    # vitest — funções puras de lib/
npm run lint
npm run build
```
