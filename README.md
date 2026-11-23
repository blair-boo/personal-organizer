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

## Uso offline (Apartamento, Documentos e Storage)

Apartamento, Documentos e Storage abrem sem internet, anexos incluídos. Finanças precisa de internet.

- **O que fica no aparelho:** as consultas dessas áreas (IndexedDB, via `@tanstack/react-query-persist-client`, lista fechada em `src/lib/offline/persistencia.ts`) e os arquivos anexados (Cache Storage `arquivos-offline`, em `src/lib/offline/arquivos.ts`). Os arquivos não podem usar o cache do service worker porque os buckets são privados e a URL assinada muda a cada acesso.
- **Como fica sincronizado:** com internet, `OfflineProvider` (`src/components/OfflineContext.tsx`) busca as consultas e baixa só os anexos que faltam ou mudaram, ao abrir o app, quando a conexão volta, ao voltar pro app depois de 30 min e quando um anexo novo aparece. Clicar no indicador do cabeçalho ("Atualizado às HH:MM") faz isso na hora.
- **Sem internet:** o app usa o que está guardado. Alterações são recusadas com o aviso "Sem conexão com a internet. Esta ação precisa de internet." (editar offline fica para depois, ver o backlog compartilhado). Um arquivo só abre offline se já foi sincronizado.
- **Sessão:** o token de acesso vence em ~1 h; sem internet ele não renova. O app mantém você logado com a sessão guardada (`src/auth/sessaoGuardada.ts`) e renova quando a internet volta.
- **Settings → App:** verificar atualização do app, sincronizar, Recarregar tudo (apaga os arquivos guardados e baixa tudo de novo), Apagar dados offline e Esvaziar cache (nunca apaga os dados offline e é recusado sem internet, para o app continuar abrindo).
- **Privacidade:** os dados guardados incluem os documentos, sem criptografia, no armazenamento do próprio navegador. Sair da conta apaga tudo (dados, arquivos e caches antigos). O service worker não guarda mais respostas da API nem arquivos privados.
- **Se mudar o formato de uma consulta guardada:** aumente `VERSAO_DO_CACHE` em `persistencia.ts`; o que estava guardado é descartado.

## Storage (caixas com etiqueta)

Aba **Storage**, ao lado de Apartamento: cadastro de caixas e do que há dentro de cada uma (itens com quantidade opcional, tag, observações e fotos/anexos). Cada caixa tem um código (`C-014`) que vira a etiqueta.

- **Ler código:** abre a câmera e lê o rMQR (ou QR comum) da etiqueta; mostra o conteúdo da caixa. Também lê de uma imagem.
- **Tags:** o item da caixa usa as mesmas tags (cômodos) dos itens de Apartamento e das tarefas de manutenção (`tags_itens`, geridas em Settings). Excluir uma tag deixa os itens e as tarefas sem ela.
- **Filtro por tag:** botões de tag acima da lista mostram as caixas que têm algum item com a tag (vale qualquer uma das ligadas).
- **Nova caixa / Etiqueta:** cadastra a caixa e gera a etiqueta em rMQR (retangular, cabe em fita estreita), com o nome da caixa ao lado do código se quiser. O PNG baixado tem módulos grandes para imprimir sem borrar. **Etiquetas** (ao lado de Nova caixa) baixa várias etiquetas numa imagem só, em grade de duas colunas.
- **Biblioteca:** `zxing-wasm` (`src/lib/rmqr.ts`). Os `.wasm` vão no próprio app e entram no precache do service worker (`vite.config.ts`), então ler e gerar funcionam sem internet. O código é carregado só quando a tela do leitor ou da etiqueta abre.
- **Dados:** tabelas `storage`, `storage_itens`, `storage_obs` e `storage_anexos` (migrations `0017_storage.sql` e `0018_storage_usa_tags_itens.sql`; a `0019_tags_unificadas.sql` fez as tarefas usarem as mesmas tags). Os arquivos ficam no bucket privado `confidencial`, subpasta `storage/`.
- **Offline:** as consultas de Storage estão em `CONSULTAS_OFFLINE` e no aquecimento, e `storage_anexos` em `BUCKET_POR_CONSULTA`.

## Manutenção: filtros e kanban

Em Apartamento > Manutenção, abaixo do título: busca (só no nome da tarefa) e botões de filtro por cômodo, período e situação (Feitas / Não feitas). Dentro de um grupo vale "ou"; entre grupos vale "e". O calendário e o CSV respeitam os filtros. Feita = já foi feita neste ciclo (próxima execução no futuro); nunca feita, vencida ou para hoje = não feita. Dois botões no título alternam entre lista e kanban; o kanban agrupa por cômodo (tarefa com vários cômodos aparece em cada um) ou por período (Diária, Semanal, Mensal, Bimestral, A cada 4 meses, Semestral, Anual, A cada 2 anos; lógica em `src/lib/filtrosManutencao.ts`). Arrastar um cartão para outra coluna troca o cômodo (por cômodo, mantendo os outros cômodos da tarefa) ou a frequência (por período). "Atrasadas" é um filtro à parte, e o cabeçalho mostra quantas tarefas estão atrasadas.

**Dia da semana e instruções:** a tarefa semanal pode ter dias da semana (Seg a Dom; coluna `dias_semana`, 0 = segunda) e qualquer tarefa pode ter instruções (aparecem ao clicar no nome). Os dias só organizam: aparecem ao lado do período, têm filtro próprio e um terceiro agrupamento do kanban ("Por dia da semana"; arrastar entre dias troca o dia). A próxima execução continua contada pela frequência. Migration `0021`.

**Feita hoje, histórico e atraso:** "Feita hoje" grava a data de hoje. Se a tarefa estava atrasada, pergunta de onde conta a próxima: voltar à data original (marcado de início) ou a partir de hoje. A tarefa feita com atraso ganha uma bandeira. O botão **Histórico** de cada tarefa deixa trocar a data de uma execução, incluir outra data à mão, excluir uma execução e mudar a escolha da base nas feitas com atraso (tabela `tarefas_manutencao_historico`, colunas `data_prevista` e `base_proxima`; migration `0020`; lógica em `src/lib/historicoTarefa.ts`).

## Editar sem internet (Storage e Manutenção)

Storage (caixas, itens, observações, tags e fotos) e, na Manutenção, "Feita hoje" e o Histórico aceitam alterações sem internet. Itens, Projetos e Documentos ainda recusam (fase 2, ver o backlog compartilhado).

- **Como funciona:** sem internet a alteração aparece na tela na hora e entra numa fila guardada no IndexedDB do aparelho (`src/lib/offline/fila.ts`; aceita Blob, então as fotos tiradas sem sinal vão junto). Quando a conexão volta, o `OfflineProvider` envia a fila em ordem, antes de buscar as consultas de novo (`src/lib/offline/enviarFila.ts`). Se uma alteração falhar, o envio para nela, avisa o erro e tenta de novo na próxima vez.
- **Onde fica cada peça:** os tipos de alteração em `operacoes.ts`, a gravação no servidor em `executores.ts` (a mesma usada com internet; aguenta rodar de novo, por isso usa upsert), o efeito na tela em `aplicarLocal.ts` (funções puras, com testes) e a decisão de rodar na hora ou enfileirar em `executarOuEnfileirar.ts`. Hook novo que queira funcionar offline: passa por `executarOuEnfileirar` e sobrescreve `onMutate: () => undefined` (o `main.tsx` recusa as demais).
- **Códigos de caixa:** o número da caixa nova (o maior + 1) é definido no aparelho, pra valer também sem internet.
- **Conflito:** vale a última alteração enviada. Fotos: a cópia local aparece normalmente e sobe com a fila.
- **Indicador:** o cabeçalho mostra "N alterações pendentes" (toque para enviar). Settings > App tem "Enviar agora" e "Descartar pendências". Sair da conta com pendências pergunta antes, porque sair apaga tudo do aparelho.

## Responsáveis das tarefas e casal

- **Casal:** em Documentos > Pessoais, um cadastro é uma pessoa ou um **casal**, que junta duas pessoas (`documentos_pessoas.tipo` e `documentos_casal_membros`). **+ Casal** escolhe as duas pessoas ou cria uma nova na hora. O "Casal" que já existia passou a juntar Eduardo e Mariana.
- **Login:** `documentos_pessoas.usuario_id` liga a pessoa ao login dela, para o app saber quem está usando. Hoje só a Mariana está ligada; quando o Eduardo ganhar login, basta preencher o `usuario_id` dele.
- **Responsável da tarefa:** escolha única no formulário: Nenhuma, cada pessoa, ou **Qualquer um** / **Juntos** (do casal). Filtro por pessoa (a tarefa do casal é de cada um dos dois), "Sem responsável" e kanban "Por pessoa" (arrastar muda a atribuição). Lógica em `src/lib/responsaveis.ts`.
- **Feita hoje:** abre uma janela com **quem fez** (as pessoas, não o casal). Já vem marcado: nas tarefas Juntos, os dois; nas Qualquer um, quem está usando o app (se for do casal); numa pessoa, ela; sem responsável, quem está usando. Marcar as duas = fizeram juntas. Cada execução guarda quem fez (`tarefas_historico_pessoas`) e o Histórico deixa trocar. Migration `0022`.

## Gatos (Documentos > Gatos)

Sub-abas por gato (`+ Gato`; modo de edição para renomear, reordenar e excluir, que apaga tudo do gato com os arquivos). Cada gato tem data de nascimento com a idade calculada e seções que abrem e fecham: **Vacinas** (data e próxima dose), **Vermífugo** (data, produto e próximo), **Consultas** (data, veterinário, observação), **Exames** (data, nome e arquivo no bucket `confidencial`, subpasta `gatos/`), **Peso** (data e kg, com a variação) e **Documentos** (lista livre, a mesma das outras áreas, com `documentos.area = 'gatos'`). No topo, o quadro **Próximas vacinas e vermífugos** (de cada vacina conta só a aplicação mais recente; vencidas em destaque, as de até 30 dias sinalizadas). Migration `0023`; lógica em `src/lib/gatos.ts`.

- **Calendário:** as próximas datas entram nos links de assinatura (.ics) marcados com "Incluir as próximas vacinas e vermífugos dos gatos" em Settings > Calendário (os links que valiam para todas as pessoas já vêm marcados). O aviso toca 3 dias antes. A Edge Function `documentos-ics` foi atualizada; o código fica em `supabase/functions/documentos-ics`.
- **Offline:** a aba abre sem internet, arquivos dos exames incluídos (cache `v4`). Editar gatos sem internet fica para a fase 2.

## Exportar tarefas para planilha

Em Apartamento > Manutenção, **Exportar planilha** gera um .xlsx no formato da aba Esqueleto da planilha de rotinas. Três abas: **Esqueleto** (blocos Monthly, Bi-Monthly, Quarterly or Every 4-Months, Bi Annual, Annual e 2 Years, com os 12 meses do ano), **Diárias e semanais** (mês e ano no topo e uma coluna por dia, com os blocos Daily, Weekly e Every 15 Days) e **Dados** (todas as colunas). Verde (DUE): feita no prazo ou ainda por vencer, com o dia na célula; vermelho (OVERDUE): feita fora da data prevista, só no mês ou dia em que foi feita. Tarefa de frequência fora desses blocos aparece só em Dados. Exporta as tarefas filtradas na tela (sem filtro, todas); o cômodo no nome da linha é opcional. Lógica em `src/lib/exportacaoTarefas.ts`, arquivo em `src/lib/xlsx.ts`.

**Salvar no Google Drive (como Google Sheets):** o código (`src/lib/google.ts`) já faz login, escolha da pasta e envio, mas fica desligado até haver credenciais em `src/config.ts` (`GOOGLE_CLIENT_ID` e `GOOGLE_API_KEY`, ou `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_API_KEY` no build; os dois são públicos). Para criar, no Google Cloud Console (pode ser pelo celular, no "site para computador"):

1. Criar um projeto e ativar a **Google Drive API** e a **Google Picker API** (APIs e serviços > Biblioteca).
2. Em **Tela de permissão OAuth**: tipo Externo, nome do app, e-mail de suporte; em "Usuários de teste", o seu e-mail.
3. Em **Credenciais > Criar credenciais > ID do cliente OAuth > Aplicativo da Web**: origem JavaScript autorizada `https://blair-boo.github.io`. Isso dá o `GOOGLE_CLIENT_ID`.
4. Em **Credenciais > Criar credenciais > Chave de API**: restringir a origem (referenciadores HTTP) a `https://blair-boo.github.io/*` e as APIs a Drive e Picker. Isso dá a `GOOGLE_API_KEY`.

O escopo usado é `drive.file`: o app só enxerga o que ele cria e a pasta que você escolhe no seletor. Precisa de internet.

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
