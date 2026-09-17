// Feed de assinatura de calendário (.ics) dos vencimentos de Documentos >
// Pessoais. Endpoint público (sem JWT do Supabase — quem busca essa URL é o
// servidor da Apple/Google, não um navegador logado), protegido por um token
// secreto na query string, conferido contra `documentos_calendario_config`.
// Só expõe título + pessoa + data: nunca número, campos ou anexos do
// documento, porque essa URL é mais fácil de vazar que uma sessão logada.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface LinhaVencimento {
  id: string;
  titulo: string;
  vencimento_calculada: string;
  aviso_dias: number | null;
  pessoa: { nome: string } | null;
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

function gerarIcs(linhas: LinhaVencimento[]): string {
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
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Organizer//Documentos Pessoais//PT",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Documentos vencendo",
    ...eventos,
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

  const { data: config, error: erroConfig } = await supabase
    .from("documentos_calendario_config")
    .select("token")
    .eq("id", 1)
    .single();

  if (erroConfig || !config || config.token !== token) {
    return new Response("Não encontrado.", { status: 404 });
  }

  const { data, error } = await supabase
    .from("documentos")
    .select("id, titulo, vencimento_calculada, aviso_dias, pessoa:documentos_pessoas(nome)")
    .eq("area", "pessoais")
    .eq("aviso_vencimento", true)
    .not("vencimento_calculada", "is", null);

  if (error) {
    return new Response("Erro ao buscar vencimentos.", { status: 500 });
  }

  const ics = gerarIcs((data ?? []) as unknown as LinhaVencimento[]);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="documentos-vencimentos.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
});
