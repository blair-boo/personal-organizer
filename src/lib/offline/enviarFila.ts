import { listarFila, removerDaFila, type OperacaoPendente } from './fila';

export interface ResultadoDoEnvio {
  enviadas: number;
  /** Mensagem do erro que parou o envio; null = a fila esvaziou. */
  erro: string | null;
}

let enviando: Promise<ResultadoDoEnvio> | null = null;

/**
 * Envia a fila na ordem em que as alterações foram feitas. Para na primeira que
 * falhar (as seguintes podem depender dela) e a deixa na fila, pra tentar de
 * novo na próxima vez. Duas chamadas ao mesmo tempo dividem o mesmo envio.
 */
export function enviarFila(
  executar: (operacao: OperacaoPendente) => Promise<void>,
  mensagemDeErro: (erro: unknown) => string
): Promise<ResultadoDoEnvio> {
  if (enviando) return enviando;
  enviando = (async () => {
    let enviadas = 0;
    try {
      for (const operacao of await listarFila()) {
        try {
          await executar(operacao);
        } catch (erro) {
          return { enviadas, erro: mensagemDeErro(erro) };
        }
        await removerDaFila(operacao.id);
        enviadas++;
      }
      return { enviadas, erro: null };
    } finally {
      enviando = null;
    }
  })();
  return enviando;
}
