import type { Conta, TipoConta } from '../types';

export const TIPO_CONTA_INFO: Record<TipoConta, { label: string; sigla: string; ehCartao: boolean }> = {
  conta_corrente: { label: 'Conta corrente', sigla: 'cc', ehCartao: false },
  conta_poupanca: { label: 'Conta poupança', sigla: 'cp', ehCartao: false },
  conta_investimento: { label: 'Conta investimento', sigla: 'ci', ehCartao: false },
  cartao_credito: { label: 'Cartão de crédito', sigla: '—', ehCartao: true },
  cartao_beneficio: { label: 'Cartão benefício', sigla: '—', ehCartao: true },
};

export function ehCartao(tipo: TipoConta): boolean {
  return TIPO_CONTA_INFO[tipo].ehCartao;
}

/** Rótulo de exibição: usa o nome se ela deu um; senão monta a partir dos dados de identificação. */
export function rotuloConta(conta: Conta): string {
  if (conta.nome) return conta.nome;

  if (ehCartao(conta.tipo)) {
    const partes = [conta.emissora, conta.ultimos_4_digitos ? `•••• ${conta.ultimos_4_digitos}` : null].filter(Boolean);
    let base = partes.length > 0 ? partes.join(' ') : conta.instituicao;
    if (conta.formato === 'virtual') {
      base += ` (Virtual${conta.subtipo_virtual ? `, ${conta.subtipo_virtual === 'recorrente' ? 'recorrente' : 'expirável'}` : ''})`;
    } else if (conta.formato === 'fisico') {
      base += ' (Físico)';
    }
    return base;
  }

  return `${TIPO_CONTA_INFO[conta.tipo].label} — ${conta.instituicao}`;
}
