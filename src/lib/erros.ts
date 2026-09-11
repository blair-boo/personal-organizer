/** Extrai uma mensagem legível de qualquer formato de erro (Error, PostgrestError, objeto plano, string). */
export function mensagemDeErro(err: unknown): string {
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
