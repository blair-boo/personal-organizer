# Personal Organizer

PWA pessoal (Vite + React + TypeScript + Supabase + react-query), publicado no
GitHub Pages. Tudo em português: nomes de variáveis, funções, comentários,
mensagens de commit e textos de interface.

## Antes de escrever qualquer código de interface

Todo pedido que crie ou altere tela, formulário, campo, botão, anexo, lista,
modal ou item de lista passa pela skill `padrao-ps` (ex-`padrao-ui`) ANTES da primeira linha de
código. Fluxo obrigatório:

1. Ler a skill `padrao-ps` por inteiro (o arquivo `.claude/skills/padrao-ui/SKILL.md` não existe neste repo).
2. Fazer o bloco de perguntas de lá em UMA mensagem só, numerada, com a opção
   padrão já marcada em cada item.
3. Esperar a resposta. Se a resposta cobrir só parte das perguntas, assumir o
   padrão no restante e listar essas premissas em três linhas antes de começar.
4. Implementar seguindo o padrão ao pé da letra. Qualquer variação "melhorada"
   precisa ser proposta antes, não entregue pronta.

## Estrutura de pastas (não criar pasta nova sem perguntar)

```
src/
  auth/            AuthContext (login por email/senha)
  components/      componentes de UI reutilizáveis
  hooks/           acesso a dados (Supabase + react-query), um arquivo por entidade
  lib/             lógica pura testável (parser, normalização, storage, datas)
  pages/
    financas/      extrato, fatura, resumos, importação
    apartamento/   itens, projetos, manutenção
    settings/      categorias, contas, banco de lançamentos, classificações
  styles/          CSS puro, um arquivo por área
supabase/
  migrations/      schema versionado (aplicado também via MCP do Supabase)
```

## Reuso obrigatório

Antes de criar componente novo, procurar em `src/components`. Já existem e
devem ser usados sempre que couber:

- `ModalBase` para qualquer modal.
- `useDialogos()` para confirmação (`confirmar`) e pergunta de texto (`pedirTexto`).
- `useToast()` para todo retorno de sucesso e de erro.
- `IconeSupabase` e `IconePng` para qualquer ícone.
- `ArquivoLink` para abrir arquivo de bucket privado (gera URL assinada).
- `TagMultiSelect` e `TagsChips` quando houver seleção de tags.

## Ícones

Todos vêm do bucket `icones` do Supabase Storage (público para leitura, ver
migration 0009), via `<IconeSupabase arquivo="nome.svg" />` (SVG, aceita máscara
com `currentColor`) ou `<IconePng arquivo="PNG/nome.png" />` (ilustração colorida).

- Nunca usar emoji, caractere solto (`✎`, `×`, `👁`) ou biblioteca de ícones,
  exceto os substitutos provisórios descritos abaixo.
- Em uso hoje: `broomstick.svg` (modo de edição), `save.svg` (salvar),
  `trash3.svg` (excluir).
- Ícone de ação (salvar, editar, excluir, adicionar, mover, copiar, fechar,
  confirmar, atualizar, selecionar): sempre `<IconeFuncao funcao="salvar" />`,
  nunca `<IconeSupabase arquivo="save.svg" />`. O arquivo de cada função é
  escolhido em Settings > Ícones > Ícones (Settings) e vale para o app todo
  (registro em `src/lib/iconesFuncoes.ts`). Função nova entra nesse registro.
- Ícone que ilustra título (categoria, aba): `<IconeUso alvoTipo alvoId rotulo />`,
  com `modoEdicao`/`onEditar` abrindo `ModalIcone`. Dados em `icones_usos`.
- Abas (principais e sub-abas) usam `<NavAbas grupo="..." />`; nome, ícone e
  ordem vêm de `abas_config`. Aba nova entra em `src/lib/abas.ts`.
- Se o ícone necessário não existir no bucket, NÃO parar. Usar um substituto
  provisório: SVG inline simples, criado só em `src/components/IconesProvisorios.tsx`,
  com o comentário `// PROVISORIO: trocar por <nome-sugerido>.svg`. Nunca emoji
  nem caractere solto.
- Todo substituto provisório entra na lista `ICONES_PENDENTES.md` (raiz do repo)
  e também na tabela "personal-organizer: ícones pendentes" do backlog
  compartilhado (ver o fim deste arquivo), e deve ser citado na resposta final,
  para o usuário enviar o arquivo depois.
- Quando o arquivo for enviado ao bucket, trocar o uso pelo ícone real, remover
  o substituto de `IconesProvisorios.tsx` e apagar a linha da lista.

## Estilo

CSS puro, um arquivo por área em `src/styles`. Sem `style` inline, sem Tailwind,
sem biblioteca de componentes. Usar apenas as variáveis já existentes
(`var(--bg)`, `var(--bg-raised)`, `var(--border)`, `var(--text)`, `var(--text-h)`,
`var(--danger)`, `var(--accent-border)`). Cor ou token novo só com aprovação
explícita.

Classes já disponíveis, preferir a criar equivalente: `.btn-icone`,
`.btn-icone-perigo`, `.icone-mascarado`, `.modal-acoes`, `.modal-edicao`,
`.lista-documentos`, `.documentos-secao`, `.upload-form`, `.hierarquia-vazio`.

## Dados

- Um hook por entidade em `src/hooks`, react-query direto sobre o Supabase.
- Tipos em `src/types/index.ts`, nunca declarados soltos na página.
- Toda mudança de schema vira migration numerada em `supabase/migrations`.
- Caminho de arquivo no Storage sempre por função em `src/lib/storage.ts`
  (padrão `caminhoXxx(...)`), nunca string montada dentro do componente.
- Bucket sempre privado, acesso só autenticado, com policy na migration.

## Feedback, erros e estados

- Sucesso e erro sempre com `mostrarToast(...)`, erro formatado por
  `mensagemDeErro(err)`.
- Ação destrutiva sempre com `confirmar({ ..., perigoso: true })`.
- Toda tela ou seção trata os três estados: carregando (`Carregando…`), vazio
  (frase curta com a classe de vazio) e erro.
- Todo botão de ícone leva `title` e `aria-label`.

## Antes de dizer que terminou

Rodar `npm run lint`, `npm test` e `npm run build`. Se algum falhar, corrigir ou
avisar de forma explícita. Não declarar pronto sem ter rodado.

Se alguma parte do pedido não foi feita, dizer qual e por quê. Entregar parcial
dizendo que está completo é o pior resultado possível.

## Backlog compartilhado

O que combinamos fazer "depois", de todos os projetos, fica no documento
compartilhado "Backlog dos projetos" (Claude Docs):
https://claude.ai/code/artifact/16715225-4af5-4a33-8479-1837e75eb556
Cada projeto tem um tópico (este é "personal-organizer"). Regras:

- Quando a usuária disser que algo fica para depois, registrar lá na hora, sem
  ela precisar pedir. Ao fazer um item, apagar a linha.
- Ler o tópico antes de propor algo novo, para não repetir o que já foi
  combinado ou descartado.
- Se não conseguir abrir o documento, avisar a usuária em vez de seguir sem ele.
