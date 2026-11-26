// Convidar e excluir logins pelo painel Settings > Usuários. Precisa da chave de serviço
// (SUPABASE_SERVICE_ROLE_KEY, já presente nas edge functions), por isso fica aqui e não no navegador.
// Só admin chama: o JWT de quem chama é conferido contra `perfis.papel`.
//
// Convite: cria o login na hora (o perfil nasce por trigger, antes do aceite) e manda o e-mail.
// Se o Supabase não conseguir enviar o e-mail (limite do SMTP padrão, endereço não autorizado),
// devolve um link de acesso para o admin mandar por outro meio.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** O link do convite só pode voltar para o app publicado ou para o ambiente local. */
const DESTINOS_PERMITIDOS = ["https://blair-boo.github.io/personal-organizer", "http://localhost", "http://127.0.0.1"];

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responder(corpo: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function destinoValido(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  return DESTINOS_PERMITIDOS.some((permitido) => url === permitido || url.startsWith(`${permitido}/`) || url.startsWith(`${permitido}:`)) ? url : undefined;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return responder({ erro: "Método não permitido." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: autenticado, error: erroAuth } = await admin.auth.getUser(token);
  if (erroAuth || !autenticado.user) return responder({ erro: "Sessão inválida. Entre de novo." }, 401);
  const chamador = autenticado.user;

  const { data: perfil } = await admin.from("perfis").select("papel").eq("usuario_id", chamador.id).maybeSingle();
  if (perfil?.papel !== "admin") return responder({ erro: "Só um admin pode fazer isso." }, 403);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return responder({ erro: "Pedido inválido." }, 400);
  }

  if (corpo.acao === "convidar") {
    const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
    if (!REGEX_EMAIL.test(email)) return responder({ erro: "Informe um e-mail válido." });
    const { data: existente } = await admin.from("perfis").select("usuario_id").ilike("email", email).maybeSingle();
    if (existente) return responder({ erro: "Já existe um usuário com esse e-mail." });
    const redirectTo = destinoValido(corpo.redirectTo);

    const { error: erroConvite } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!erroConvite) return responder({ ok: true, enviado: true });

    // O envio do e-mail falhou. O login pode ou não ter sido criado: gera o link do jeito certo para cada caso.
    const { data: criado } = await admin.from("perfis").select("usuario_id").ilike("email", email).maybeSingle();
    const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
      type: criado ? "recovery" : "invite",
      email,
      options: { redirectTo },
    });
    if (erroLink || !link?.properties?.action_link) return responder({ erro: erroConvite.message });
    return responder({ ok: true, enviado: false, link: link.properties.action_link, motivo: erroConvite.message });
  }

  if (corpo.acao === "excluir") {
    const usuarioId = typeof corpo.usuarioId === "string" ? corpo.usuarioId : "";
    if (!REGEX_UUID.test(usuarioId)) return responder({ erro: "Usuário inválido." });
    if (usuarioId === chamador.id) return responder({ erro: "Você não pode excluir o próprio usuário." });
    const { data: alvo } = await admin.from("perfis").select("usuario_id").eq("usuario_id", usuarioId).maybeSingle();
    if (!alvo) return responder({ erro: "Usuário não encontrado." });
    const { error: erroExcluir } = await admin.auth.admin.deleteUser(usuarioId);
    if (erroExcluir) return responder({ erro: erroExcluir.message });
    return responder({ ok: true });
  }

  return responder({ erro: "Ação desconhecida." }, 400);
});
