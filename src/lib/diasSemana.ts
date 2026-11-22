/** Dias da semana como guardados no banco: 0 = segunda ... 6 = domingo. */
export const DIAS_DA_SEMANA = [0, 1, 2, 3, 4, 5, 6] as const;

export const ROTULOS_DIA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const ROTULOS_DIA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Liga ou desliga um dia, mantendo a lista em ordem. */
export function alternarDia(dias: number[], dia: number): number[] {
  return (dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia]).sort((a, b) => a - b);
}

/** "Seg, Sex" */
export function resumoDosDias(dias: number[]): string {
  return [...dias].sort((a, b) => a - b).map((d) => ROTULOS_DIA_CURTO[d]).join(', ');
}

/** Só tarefa semanal (a cada 7 dias) tem dia da semana. */
export function aceitaDiaDaSemana(frequenciaDias: number): boolean {
  return frequenciaDias === 7;
}
