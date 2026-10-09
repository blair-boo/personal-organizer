import { baixarCsv, gerarCsv, type ColunaCsv } from '../lib/csv';
import { mensagemDeErro } from '../lib/erros';
import { IconeFuncao } from './IconeUso';
import { useToast } from './Toast';

/** Botão de ícone que baixa a lista mostrada na tela como CSV (abre no Excel em português). */
export function BotaoExportarCsv<T>({ nome, colunas, linhas }: { nome: string; colunas: ColunaCsv<T>[]; linhas: T[] | undefined }) {
  const { mostrarToast } = useToast();

  function exportar() {
    try {
      baixarCsv(nome, gerarCsv(colunas, linhas ?? []));
      mostrarToast('CSV exportado.');
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), 'erro');
    }
  }

  return (
    <button
      type="button"
      className="btn-icone icone-uso-botao"
      onClick={exportar}
      disabled={!linhas || linhas.length === 0}
      title="Exportar CSV"
      aria-label={`Exportar ${nome} em CSV`}
    >
      <IconeFuncao funcao="exportar" tamanho={18} />
    </button>
  );
}
