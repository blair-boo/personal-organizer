// Feed de assinatura de calendário (.ics) dos vencimentos de Documentos >
// Pessoais e, nos links que pedem (`incluir_gatos`), das próximas vacinas e
// vermífugos dos gatos. Endpoint público (sem JWT do Supabase — quem busca essa URL é o
// servidor da Apple/Google, não um navegador logado), protegido por um token
// secreto na query string, conferido contra `documentos_calendario_feeds`.
// Cada feed pode filtrar por um subconjunto de pessoas (nenhuma linha em
// `documentos_calendario_feed_pessoas` = todas). Só expõe título + pessoa +
// data: nunca número, campos ou anexos do documento, porque essa URL é mais
// fácil de vazar que uma sessão logada.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface LinhaVencimento {
  id: string;
  titulo: string;
  vencimento_calculada: string;
  aviso_dias: number | null;
  pessoa_id: string | null;
  pessoa: { nome: string } | null;
}

interface LinhaGato {
  id: string;
  nome: string;
}

interface LinhaVacina {
  id: string;
  gato_id: string;
  vacina: string;
  data: string;
  proxima_data: string | null;
}

interface LinhaVermifugo {
  id: string;
  gato_id: string;
  data: string;
  produto: string;
  proxima_data: string | null;
}

interface EventoGato {
  id: string;
  resumo: string;
  data: string;
}

// Quantos dias antes da data o aviso do calendário toca (mesmo valor do app, src/lib/gatos.ts).
const DIAS_DE_AVISO_GATOS = 3;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Mesma regra do quadro "Próximas" do app: de cada vacina conta só a aplicação mais
// recente e, do vermífugo, a mais recente de cada gato.
function eventosDosGatos(gatos: LinhaGato[], vacinas: LinhaVacina[], vermifugos: LinhaVermifugo[]): EventoGato[] {
  const nomePorGato = new Map(gatos.map((g) => [g.id, g.nome]));
  const ultimaVacina = new Map<string, LinhaVacina>();
  for (const v of vacinas) {
    const chave = `${v.gato_id}|${normalizar(v.vacina)}`;
    const atual = ultimaVacina.get(chave);
    if (!atual || v.data > atual.data) ultimaVacina.set(chave, v);
  }
  const ultimoVermifugo = new Map<string, LinhaVermifugo>();
  for (const v of vermifugos) {
    const atual = ultimoVermifugo.get(v.gato_id);
    if (!atual || v.data > atual.data) ultimoVermifugo.set(v.gato_id, v);
  }
  const eventos: EventoGato[] = [];
  for (const v of ultimaVacina.values()) {
    const nome = nomePorGato.get(v.gato_id);
    if (nome && v.proxima_data) eventos.push({ id: `vacina-${v.id}`, resumo: `Vacina ${v.vacina.trim()} de ${nome}`, data: v.proxima_data });
  }
  for (const v of ultimoVermifugo.values()) {
    const nome = nomePorGato.get(v.gato_id);
    if (nome && v.proxima_data) eventos.push({ id: `vermifugo-${v.id}`, resumo: `Vermífugo (${v.produto.trim()}) de ${nome}`, data: v.proxima_data });
  }
  return eventos;
}

function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function formatarDataIcs(dataIso: string): string {
  return dataIso.replaceAll("-", "");
}

function formatarCarimboIcs(data: Date): string {
  return data.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function gerarIcs(nomeFeed: string, linhas: LinhaVencimento[], eventosGatos: EventoGato[]): string {
  const agora = formatarCarimboIcs(new Date());
  const eventos = linhas
    .filter((linha) => linha.pessoa)
    .map((linha) => {
      const dias = linha.aviso_dias ?? 0;
      const gatilho = dias > 0 ? `-P${dias}D` : "PT0S";
      const resumo = escaparTexto(`${linha.titulo} de ${linha.pessoa!.nome}`);
      return [
        "BEGIN:VEVENT",
        `UID:${linha.id}@personal-organizer`,
        `DTSTAMP:${agora}`,
        `DTSTART;VALUE=DATE:${formatarDataIcs(linha.vencimento_calculada)}`,
        `SUMMARY:${resumo}`,
        "BEGIN:VALARM",
        `TRIGGER:${gatilho}`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${resumo}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  const eventosDeGatos = eventosGatos.map((evento) => {
    const resumo = escaparTexto(evento.resumo);
    return [
      "BEGIN:VEVENT",
      `UID:${evento.id}@personal-organizer`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${formatarDataIcs(evento.data)}`,
      `SUMMARY:${resumo}`,
      "BEGIN:VALARM",
      `TRIGGER:-P${DIAS_DE_AVISO_GATOS}D`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${resumo}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Organizer//Documentos Pessoais//PT",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:Documentos vencendo — ${escaparTexto(nomeFeed)}`,
    ...eventos,
    ...eventosDeGatos,
    "END:VCALENDAR",
  ].join("\r\n");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Token não informado.", { status: 404 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: feed, error: erroFeed } = await supabase
    .from("documentos_calendario_feeds")
    .select("id, nome, incluir_gatos")
    .eq("token", token)
    .single();

  if (erroFeed || !feed) {
    return new Response("Não encontrado.", { status: 404 });
  }

  const { data: pessoasFeed, error: erroPessoasFeed } = await supabase
    .from("documentos_calendario_feed_pessoas")
    .select("pessoa_id")
    .eq("feed_id", feed.id);

  if (erroPessoasFeed) {
    return new Response("Erro ao buscar pessoas do link.", { status: 500 });
  }

  const pessoaIds = (pessoasFeed ?? []).map((p) => p.pessoa_id);

  let query = supabase
    .from("documentos")
    .select("id, titulo, vencimento_calculada, aviso_dias, pessoa_id, pessoa:documentos_pessoas(nome)")
    .eq("area", "pessoais")
    .eq("aviso_vencimento", true)
    .not("vencimento_calculada", "is", null);

  if (pessoaIds.length > 0) {
    query = query.in("pessoa_id", pessoaIds);
  }

  const { data, error } = await query;

  if (error) {
    return new Response("Erro ao buscar vencimentos.", { status: 500 });
  }

  let eventosGatos: EventoGato[] = [];
  if (feed.incluir_gatos) {
    const [gatos, vacinas, vermifugos] = await Promise.all([
      supabase.from("gatos").select("id, nome"),
      supabase.from("gato_vacinas").select("id, gato_id, vacina, data, proxima_data"),
      supabase.from("gato_vermifugos").select("id, gato_id, data, produto, proxima_data"),
    ]);
    if (gatos.error || vacinas.error || vermifugos.error) {
      return new Response("Erro ao buscar os gatos.", { status: 500 });
    }
    eventosGatos = eventosDosGatos(gatos.data as LinhaGato[], vacinas.data as LinhaVacina[], vermifugos.data as LinhaVermifugo[]);
  }

  const ics = gerarIcs(feed.nome, (data ?? []) as unknown as LinhaVencimento[], eventosGatos);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="documentos-vencimentos.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
});
