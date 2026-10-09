// Backup do Supabase para o Cloudflare R2 (rodado por .github/workflows/backup.yml).
//
// Layout no bucket do R2:
//   db/semanal/AAAA-MM-DD/<tabela>.json   4 mais novos (todo domingo)
//   db/mensal/AAAA-MM/<tabela>.json       4 mais novos (primeiro domingo do mês)
//   storage/<bucket>/<caminho>            espelho único dos arquivos do Storage
//
// Tabelas e buckets são DESCOBERTOS no próprio Supabase a cada execução (o
// OpenAPI do PostgREST lista as tabelas e suas chaves primárias; a API de
// Storage lista os buckets). Assim, tabela ou bucket novo entra no backup sem
// mexer neste arquivo, e tabela removida/renomeada por migration não quebra nada.
//
// O banco (pequeno) é exportado inteiro a cada execução. Os arquivos do Storage
// são incrementais: só baixa do Supabase o que falta no R2 (ou mudou de
// tamanho), pra não gastar o tráfego (egress) do Supabase toda semana. Em
// janeiro e julho (primeiro domingo) também apaga do R2 o que já não existe no
// Supabase, com uma trava de segurança contra listagens vazias/incompletas.
//
// No fim, publica um resumo (backups existentes + tamanho do bucket) na tabela
// backup_status do Supabase, que a aba Settings > Backup do app lê (o navegador
// não alcança o R2). Essa etapa NÃO derruba o backup se falhar (ex.: migration
// 0016 ainda não aplicada): o backup em si já terminou nesse ponto.
//
// Falha alto de propósito: qualquer erro sai com código != 0, pra nunca tratar
// um backup parcial como válido (e a poda de backups antigos só roda depois do
// envio). Só usa módulos nativos do Node 22 e o rclone (configurado por variáveis
// de ambiente RCLONE_CONFIG_R2_*, sem arquivo).

import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const executar = promisify(execFile);

const MANTER = 4;
const PAGINA = 1000;
const TIMEOUT_MS = 60_000;
const DOWNLOADS_SIMULTANEOS = 5;

// --- Regras puras (testadas em backup-supabase.test.mjs) ---------------------

/** Chaves além das `manter` mais novas. Os nomes são datas ISO (AAAA-MM-DD ou
 *  AAAA-MM), então a ordem alfabética é a cronológica. */
export function chavesAApagar(chaves, manter = MANTER) {
  const ordenadas = [...chaves].sort();
  return ordenadas.length > manter ? ordenadas.slice(0, ordenadas.length - manter) : [];
}

/** Primeira execução de domingo do mês (dia <= 7): fechou 4 semanas. */
export function deveGravarMensal(data) {
  return data.getUTCDate() <= 7;
}

/** A cada 6 meses (janeiro e julho), no primeiro domingo. */
export function deveLimparArquivos(data) {
  const mes = data.getUTCMonth();
  return (mes === 0 || mes === 6) && data.getUTCDate() <= 7;
}

/** Só apaga órfãos do R2 se a listagem do Supabase parece completa: nunca com 0
 *  objetos e nunca se ela tem menos da metade do que o R2 já guarda (provável
 *  falha de listagem, que apagaria o backup inteiro). */
export function limpezaSegura(noSupabase, noR2) {
  if (noSupabase === 0) return false;
  return noSupabase * 2 >= noR2;
}

/** { baixar, orfaos }. `baixar`: ausentes no R2 ou com tamanho diferente.
 *  `orfaos`: estão no R2 e não existem mais no Supabase. Ambos mapas caminho -> tamanho. */
export function planejarStorage(supabase, r2) {
  const baixar = Object.keys(supabase)
    .filter((caminho) => r2[caminho] !== supabase[caminho])
    .sort();
  const orfaos = Object.keys(r2)
    .filter((caminho) => !(caminho in supabase))
    .sort();
  return { baixar, orfaos };
}

/** Caminho dentro de `raiz`, ou null se o nome do objeto tentar escapar dela. */
export function caminhoLocalSeguro(raiz, relativo) {
  const alvo = path.resolve(raiz, relativo);
  const rel = path.relative(path.resolve(raiz), alvo);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) ? alvo : null;
}

/** Linha única de backup_status. `total` e `arquivos` = [bytes, objetos]. Backups
 *  ordenados do mais novo pro mais antigo, semanais antes dos mensais. */
export function montarStatus(snapshots, total, bytesBanco, arquivos) {
  const maisNovosPrimeiro = [...snapshots].sort((a, b) => b.nome.localeCompare(a.nome));
  const ordenados = [
    ...maisNovosPrimeiro.filter((b) => b.tipo === 'semanal'),
    ...maisNovosPrimeiro.filter((b) => b.tipo !== 'semanal'),
  ];
  return {
    id: 1,
    snapshots: ordenados,
    tamanho_total_bytes: total[0],
    tamanho_db_bytes: bytesBanco,
    tamanho_arquivos_bytes: arquivos[0],
    objetos_arquivos: arquivos[1],
  };
}

/** Tabelas (e views) do OpenAPI do PostgREST -> colunas de ordenação. Usa a
 *  chave primária (marcada com `<pk/>` na descrição da coluna); sem PK, ordena
 *  por todas as colunas, o que também dá uma ordem total estável pra paginar. */
export function tabelasDoOpenApi(spec) {
  const tabelas = {};
  for (const [nome, def] of Object.entries(spec?.definitions ?? {})) {
    const colunas = Object.entries(def?.properties ?? {});
    if (colunas.length === 0) continue;
    const pk = colunas.filter(([, prop]) => String(prop?.description ?? '').includes('<pk/>')).map(([coluna]) => coluna);
    tabelas[nome] = pk.length > 0 ? pk : colunas.map(([coluna]) => coluna);
  }
  return tabelas;
}

// --- Supabase ----------------------------------------------------------------

function cabecalhos(chave) {
  return { apikey: chave, Authorization: `Bearer ${chave}` };
}

async function requisitar(url, opcoes = {}) {
  const resposta = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resposta.ok) {
    const corpo = (await resposta.text()).slice(0, 300);
    throw new Error(`HTTP ${resposta.status} em ${new URL(url).pathname}: ${corpo}`);
  }
  return resposta;
}

async function descobrirTabelas(base, chave) {
  const resposta = await requisitar(`${base}/rest/v1/`, {
    headers: { ...cabecalhos(chave), Accept: 'application/openapi+json' },
  });
  const tabelas = tabelasDoOpenApi(await resposta.json());
  if (Object.keys(tabelas).length === 0) throw new Error('Nenhuma tabela encontrada no OpenAPI do Supabase');
  return tabelas;
}

async function baixarTabela(base, chave, tabela, colunasOrdem) {
  const linhas = [];
  const ordem = colunasOrdem.map((coluna) => `${coluna}.asc`).join(',');
  let inicio = 0;
  let total = null;
  while (total === null || inicio < total) {
    const resposta = await requisitar(`${base}/rest/v1/${encodeURIComponent(tabela)}?select=*&order=${ordem}`, {
      headers: { ...cabecalhos(chave), 'Range-Unit': 'items', Range: `${inicio}-${inicio + PAGINA - 1}`, Prefer: 'count=exact' },
    });
    total = Number(resposta.headers.get('content-range').split('/')[1]);
    const pagina = await resposta.json();
    if (pagina.length === 0 && inicio < total) throw new Error(`${tabela}: página vazia em ${inicio}/${total}`);
    linhas.push(...pagina);
    inicio += PAGINA;
  }
  if (linhas.length !== total) throw new Error(`${tabela}: baixou ${linhas.length} de ${total} linhas`);
  return linhas;
}

async function listarBuckets(base, chave) {
  const resposta = await requisitar(`${base}/storage/v1/bucket`, { headers: cabecalhos(chave) });
  return (await resposta.json()).map((bucket) => bucket.id);
}

/** caminho -> tamanho, recursivo. Pastas aparecem sem `id` e são percorridas. */
async function listarObjetos(base, chave, bucket, prefixo = '') {
  const objetos = {};
  for (let offset = 0; ; offset += PAGINA) {
    const resposta = await requisitar(`${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { ...cabecalhos(chave), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefixo, limit: PAGINA, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const itens = await resposta.json();
    for (const item of itens) {
      const caminho = `${prefixo}${item.name}`;
      if (item.id === null || item.id === undefined) {
        Object.assign(objetos, await listarObjetos(base, chave, bucket, `${caminho}/`));
      } else {
        objetos[caminho] = Number(item.metadata?.size ?? 0);
      }
    }
    if (itens.length < PAGINA) return objetos;
  }
}

async function baixarObjeto(base, chave, bucket, caminho, destino) {
  await mkdir(path.dirname(destino), { recursive: true });
  const rota = caminho.split('/').map(encodeURIComponent).join('/');
  const resposta = await requisitar(`${base}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${rota}`, {
    headers: cabecalhos(chave),
  });
  await pipeline(Readable.fromWeb(resposta.body), createWriteStream(destino));
}

// --- rclone ------------------------------------------------------------------

async function rclone(...args) {
  try {
    const { stdout } = await executar('rclone', args, { maxBuffer: 512 * 1024 * 1024 });
    return stdout;
  } catch (erro) {
    throw new Error(`rclone ${args[0]} falhou: ${String(erro.stderr ?? erro.message).trim().slice(0, 500)}`);
  }
}

async function listarR2(prefixo) {
  const saida = await rclone('lsjson', '-R', '--files-only', prefixo);
  return Object.fromEntries(JSON.parse(saida || '[]').map((item) => [item.Path, Number(item.Size)]));
}

/** [bytes, objetos] sob um prefixo; [0, 0] se ele ainda não existe. */
async function tamanhoR2(prefixo) {
  try {
    const { bytes, count } = JSON.parse(await rclone('size', '--json', prefixo));
    return [Number(bytes), Number(count)];
  } catch {
    return [0, 0];
  }
}

async function coletarSnapshots(raizR2) {
  const snapshots = [];
  for (const tipo of ['semanal', 'mensal']) {
    const pastas = (await rclone('lsf', '--dirs-only', `${raizR2}/db/${tipo}`)).split('\n').filter(Boolean).map((p) => p.replace(/\/$/, ''));
    for (const nome of pastas) {
      const caminho = `${raizR2}/db/${tipo}/${nome}`;
      let linhas = null;
      try {
        linhas = Object.values(JSON.parse(await rclone('cat', `${caminho}/manifest.json`)).linhas).reduce((soma, n) => soma + n, 0);
      } catch {
        // manifest ausente ou ilegível: mostra o backup sem a contagem de linhas
      }
      snapshots.push({ tipo, nome, tamanho_bytes: (await tamanhoR2(caminho))[0], linhas });
    }
  }
  return snapshots;
}

async function publicarStatus(base, chave, raizR2) {
  const status = montarStatus(
    await coletarSnapshots(raizR2),
    await tamanhoR2(raizR2),
    (await tamanhoR2(`${raizR2}/db`))[0],
    await tamanhoR2(`${raizR2}/storage`)
  );
  status.atualizado_em = new Date().toISOString();
  await requisitar(`${base}/rest/v1/backup_status`, {
    method: 'POST',
    headers: { ...cabecalhos(chave), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(status),
  });
  console.log(`  status publicado: ${status.snapshots.length} backups, bucket ${status.tamanho_total_bytes} bytes`);
}

// --- Orquestração ------------------------------------------------------------

async function exportarBanco(base, chave, destino) {
  await mkdir(destino, { recursive: true });
  const tabelas = await descobrirTabelas(base, chave);
  const contagens = {};
  for (const [tabela, ordem] of Object.entries(tabelas)) {
    const linhas = await baixarTabela(base, chave, tabela, ordem);
    await writeFile(path.join(destino, `${tabela}.json`), JSON.stringify(linhas, null, 1), 'utf8');
    contagens[tabela] = linhas.length;
    console.log(`  ${tabela}: ${linhas.length} linhas`);
  }
  await writeFile(
    path.join(destino, 'manifest.json'),
    JSON.stringify({ gerado_em: new Date().toISOString(), linhas: contagens }, null, 1),
    'utf8'
  );
}

async function enviarBanco(raizR2, origem, hoje) {
  const dia = hoje.toISOString().slice(0, 10);
  await rclone('copy', origem, `${raizR2}/db/semanal/${dia}`);
  if (deveGravarMensal(hoje)) await rclone('copy', origem, `${raizR2}/db/mensal/${dia.slice(0, 7)}`);
  // Poda só DEPOIS de o envio ter dado certo; cada grupo só mexe nele mesmo.
  for (const grupo of ['semanal', 'mensal']) {
    const pastas = (await rclone('lsf', '--dirs-only', `${raizR2}/db/${grupo}`)).split('\n').filter(Boolean).map((p) => p.replace(/\/$/, ''));
    for (const antiga of chavesAApagar(pastas)) {
      console.log(`  poda: db/${grupo}/${antiga}`);
      await rclone('purge', `${raizR2}/db/${grupo}/${antiga}`);
    }
  }
}

async function baixarEmParalelo(caminhos, baixarUm) {
  const fila = [...caminhos];
  const trabalhadores = Array.from({ length: DOWNLOADS_SIMULTANEOS }, async () => {
    while (fila.length > 0) await baixarUm(fila.shift());
  });
  await Promise.all(trabalhadores);
}

async function espelharStorage(base, chave, raizR2, tmp, hoje) {
  for (const bucket of await listarBuckets(base, chave)) {
    console.log(`bucket ${bucket}`);
    const supabase = await listarObjetos(base, chave, bucket);
    const r2 = await listarR2(`${raizR2}/storage/${bucket}`);
    const { baixar, orfaos } = planejarStorage(supabase, r2);
    console.log(`  supabase=${Object.keys(supabase).length} r2=${Object.keys(r2).length} a_enviar=${baixar.length} orfaos=${orfaos.length}`);

    const raizLocal = path.join(tmp, 'storage', bucket);
    await baixarEmParalelo(baixar, async (caminho) => {
      const destino = caminhoLocalSeguro(raizLocal, caminho);
      if (destino === null) return console.log(`  ignorado (caminho suspeito): ${caminho}`);
      await baixarObjeto(base, chave, bucket, caminho, destino);
    });
    if (baixar.length > 0) await rclone('copy', raizLocal, `${raizR2}/storage/${bucket}`);

    if (orfaos.length > 0 && deveLimparArquivos(hoje)) {
      if (limpezaSegura(Object.keys(supabase).length, Object.keys(r2).length)) {
        const lista = path.join(tmp, `orfaos-${bucket}.txt`);
        await writeFile(lista, orfaos.join('\n'), 'utf8');
        await rclone('delete', `${raizR2}/storage/${bucket}`, '--files-from', lista);
        console.log(`  limpeza: ${orfaos.length} órfãos removidos`);
      } else {
        console.log('  limpeza ABORTADA pela trava de segurança (listagem do Supabase suspeita)');
      }
    }
  }
}

async function principal() {
  const faltando = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_BUCKET'].filter((nome) => !process.env[nome]);
  if (faltando.length > 0) throw new Error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}`);
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raizR2 = `r2:${process.env.R2_BUCKET}`;
  const hoje = new Date();

  const tmp = await mkdtemp(path.join(tmpdir(), 'backup-'));
  try {
    console.log('Exportando banco');
    await exportarBanco(base, chave, path.join(tmp, 'db'));
    console.log('Enviando banco');
    await enviarBanco(raizR2, path.join(tmp, 'db'), hoje);
    console.log('Espelhando arquivos do Storage');
    await espelharStorage(base, chave, raizR2, tmp, hoje);
    console.log('Publicando status no Supabase');
    try {
      await publicarStatus(base, chave, raizR2);
    } catch (erro) {
      // O backup já terminou; só o painel do app fica sem atualizar.
      console.log(`::warning::Backup ok, mas não consegui publicar o status: ${erro.message}`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  console.log('Backup concluído');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((erro) => {
    console.error(`Backup falhou: ${erro.message}`);
    process.exit(1);
  });
}
