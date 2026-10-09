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

## Uso offline (Apartamento e Documentos)

Apartamento e Documentos abrem sem internet, anexos incluídos. Finanças precisa de internet.

- **O que fica no aparelho:** as consultas dessas duas áreas (IndexedDB, via `@tanstack/react-query-persist-client`, lista fechada em `src/lib/offline/persistencia.ts`) e os arquivos anexados (Cache Storage `arquivos-offline`, em `src/lib/offline/arquivos.ts`). Os arquivos não podem usar o cache do service worker porque os buckets são privados e a URL assinada muda a cada acesso.
- **Como fica sincronizado:** com internet, `OfflineProvider` (`src/components/OfflineContext.tsx`) busca as consultas e baixa só os anexos que faltam ou mudaram, ao abrir o app, quando a conexão volta, ao voltar pro app depois de 30 min e quando um anexo novo aparece. Clicar no indicador do cabeçalho ("Atualizado às HH:MM") faz isso na hora.
- **Sem internet:** o app usa o que está guardado. Alterações são recusadas com o aviso "Sem conexão com a internet. Esta ação precisa de internet." (editar offline fica para depois, ver o backlog compartilhado). Um arquivo só abre offline se já foi sincronizado.
- **Sessão:** o token de acesso vence em ~1 h; sem internet ele não renova. O app mantém você logado com a sessão guardada (`src/auth/sessaoGuardada.ts`) e renova quando a internet volta.
- **Settings → App:** verificar atualização do app, sincronizar, Recarregar tudo (apaga os arquivos guardados e baixa tudo de novo), Apagar dados offline e Esvaziar cache (nunca apaga os dados offline e é recusado sem internet, para o app continuar abrindo).
- **Privacidade:** os dados guardados incluem os documentos, sem criptografia, no armazenamento do próprio navegador. Sair da conta apaga tudo (dados, arquivos e caches antigos). O service worker não guarda mais respostas da API nem arquivos privados.
- **Se mudar o formato de uma consulta guardada:** aumente `VERSAO_DO_CACHE` em `persistencia.ts`; o que estava guardado é descartado.

## Exportar CSV

Botão de exportar no topo de Itens, Projetos e Manutenção (Apartamento). Separador `;`, vírgula decimal e UTF-8 com BOM (abre direto no Excel em português). Texto que começaria com `=`, `+`, `-` ou `@` ganha um apóstrofo, para a planilha não executar como fórmula. Documentos ficam fora de propósito (têm campos sensíveis).

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

**Verificação semanal:** logo depois de gravar, o workflow lê o backup de volta do R2 e confere a integridade (JSON legível e contagem de linhas igual à do `manifest.json`). Se algo estiver errado, o workflow fica vermelho. Dá pra rodar à mão: `node scripts/restaurar-supabase.mjs --verificar` (com `R2_BUCKET` e `RCLONE_CONFIG_R2_*` no ambiente).

**Restaurar** (`scripts/restaurar-supabase.mjs`)
1. Aplique as migrations (`supabase/migrations`, inclusive buckets e policies) no projeto Supabase de destino. O backup guarda os dados, não o schema, e também não guarda os usuários do Auth: crie o login no destino.
2. Ensaio, que não escreve nada:
   `ALVO_SUPABASE_URL=https://xxxx.supabase.co ALVO_SUPABASE_SERVICE_ROLE_KEY=... node scripts/restaurar-supabase.mjs --restaurar --confirmo xxxx.supabase.co`
3. Para gravar de verdade, acrescente `--executar` (e `--arquivos` para restaurar também o Storage). `--backup db/semanal/AAAA-MM-DD` (ou `db/mensal/AAAA-MM`) escolhe outro backup; sem ele usa o semanal mais novo.
4. As variáveis do destino são `ALVO_*` de propósito, para nunca reaproveitar por engano as chaves de produção do backup. `--confirmo` precisa repetir o host do destino.
5. Ao final o script confere as contagens de cada tabela no destino. Teste primeiro num projeto Supabase de teste.

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
