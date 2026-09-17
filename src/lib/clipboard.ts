type MostrarToast = (mensagem: string, tipo?: 'ok' | 'erro' | 'info') => void;

/** Copia um texto pra área de transferência, com toast de sucesso/erro. */
export async function copiarConteudo(texto: string, mostrarToast: MostrarToast, nomeCampo: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast('Copiado.');
  } catch {
    mostrarToast(`Não foi possível copiar "${nomeCampo}".`, 'erro');
  }
}
