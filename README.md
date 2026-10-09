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

## Backup para o Cloudflare R2

O workflow `.github/workflows/backup.yml` roda todo domingo (06:00 UTC, 03:00 em Brasília) e também sob demanda (Actions → Backup → Run workflow). O código está em `scripts/backup-supabase.mjs`. O agendamento só roda a partir da branch padrão do repositório.

**Secrets necessários** (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` do projeto (Project Settings → API). Ignora RLS, por isso fica só aqui, nunca no app |
| `SUPABASE_URL` | opcional: se não existir, usa `VITE_SUPABASE_URL` |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | token do R2 com Object Read & Write restrito ao bucket de backup |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | opcional: se não existir, usa `personal-organizer-backup` |

**O que fica no bucket**

| Caminho | Conteúdo | Retenção |
|---|---|---|
| `db/semanal/AAAA-MM-DD/` | um `.json` por tabela + `manifest.json` | 4 mais novos |
| `db/mensal/AAAA-MM/` | o mesmo, gravado no primeiro domingo do mês | 4 mais novos |
| `storage/<bucket>/` | espelho dos arquivos do Storage | ver abaixo |

Semanal só substitui semanal e mensal só substitui mensal. A poda só roda depois de o envio do dia dar certo.

Tabelas e buckets são descobertos no próprio Supabase a cada execução, então tabela ou bucket novo entra no backup sozinho (sem editar o script).

**Arquivos do Storage:** a cada execução só é baixado do Supabase o que falta no R2 (ou mudou de tamanho), pra poupar o tráfego do Supabase. Nada é apagado do R2 durante o ano, então uma exclusão acidental continua recuperável. Em janeiro e julho (primeiro domingo) o que já não existe no Supabase é removido do R2. Essa limpeza é abortada se a listagem do Supabase vier vazia ou com menos da metade do que o R2 já guarda. Limitação: um arquivo substituído por outro com exatamente o mesmo tamanho não é reenviado.

**Atenção:** o backup inclui os buckets privados (documentos, comprovantes, `confidencial`). Mantenha o bucket do R2 privado e o token restrito a ele.

**Aba Settings → Backup:** lista os backups que existem hoje (os já apagados pela retenção não aparecem), mostra o próximo backup e o tamanho do bucket. O navegador não alcança o R2, então no fim de cada execução o workflow publica esse resumo na tabela `backup_status` do Supabase (migration `0016_backup_status.sql`) e a aba lê de lá. Se a tabela não existir, o backup continua funcionando e o workflow só registra um aviso. O tamanho mostrado é o do fim do último backup, não o do instante. A data do próximo backup é calculada no app a partir do cron (`src/lib/backup.ts`); se mudar o horário em `backup.yml`, mude lá também.

**Restaurar**
- Tabela: baixe `db/semanal/<data>/<tabela>.json` (ou `mensal`) pelo painel do R2 ou com `rclone copy` e reimporte (ex.: `upsert` pela API do Supabase). Os JSON são o conteúdo cru das tabelas.
- Arquivos: `rclone copy r2:<bucket-do-r2>/storage/<bucket-do-supabase> <destino>` e suba de volta pelo Storage do Supabase.

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
