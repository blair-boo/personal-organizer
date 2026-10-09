export const MENSAGEM_SEM_CONEXAO = 'Sem conexão com a internet. Esta ação precisa de internet.';
const MENSAGEM_FALHA_DE_REDE = 'Não foi possível falar com o servidor. Confira a internet e tente de novo.';
const MENSAGEM_DEMOROU_DEMAIS = 'A conexão demorou demais. Tente de novo.';

// Texto que o navegador (e o supabase-js, que prefixa o nome do erro) dá quando o fetch nem chega ao servidor.
const PADRAO_FALHA_DE_REDE = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;
const PADRAO_DEMOROU_DEMAIS = /timeouterror|operation timed out|signal timed out/i;

/** Extrai uma mensagem legível de qualquer formato de erro (Error, PostgrestError, objeto plano, string). Falha de rede vira texto em português. */
export function mensagemDeErro(err: unknown): string {
  const bruta = extrairMensagem(err);
  if (PADRAO_DEMOROU_DEMAIS.test(bruta)) return MENSAGEM_DEMOROU_DEMAIS;
  if (PADRAO_FALHA_DE_REDE.test(bruta)) {
    return typeof navigator !== 'undefined' && navigator.onLine === false ? MENSAGEM_SEM_CONEXAO : MENSAGEM_FALHA_DE_REDE;
  }
  return bruta;
}

function extrairMensagem(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    for (const chave of ['message', 'error_description', 'error', 'details', 'hint']) {
      const v = o[chave];
      if (typeof v === 'string' && v.trim()) return v;
    }
    try {
      return JSON.stringify(err);
    } catch {
      /* segue pro fallback */
    }
  }
  return String(err);
}
