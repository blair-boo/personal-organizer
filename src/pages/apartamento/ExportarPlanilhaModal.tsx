import { useMemo, useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import {
  MESES,
  nomeDoArquivoDeTarefas,
  planilhaDados,
  planilhaDiaria,
  planilhaPeriodica,
  type DadosExportacao,
} from '../../lib/exportacaoTarefas';
import { enviarComoGoogleSheets, entrarNoGoogle, escolherPastaDoDrive, googleConfigurado } from '../../lib/google';
import { escreverXlsx } from '../../lib/xlsx';

type Destino = 'xlsx' | 'sheets';

function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

interface ExportarPlanilhaModalProps {
  dados: DadosExportacao;
  /** Texto de onde vêm as tarefas ("as filtradas na tela" ou "todas"). */
  origem: string;
  onFechar: () => void;
}

/** Exporta as tarefas no formato da aba Esqueleto: baixa um .xlsx ou salva no Google Drive como Google Sheets. */
export function ExportarPlanilhaModal({ dados, origem, onFechar }: ExportarPlanilhaModalProps) {
  const { mostrarToast } = useToast();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [comComodo, setComComodo] = useState(false);
  const [destino, setDestino] = useState<Destino>('xlsx');
  const [exportando, setExportando] = useState(false);
  const [salvo, setSalvo] = useState<{ nome: string; pasta: string; link: string } | null>(null);
  const driveLigado = googleConfigurado();

  const foraDoFormato = useMemo(() => planilhaPeriodica(dados, { ano, mes, comComodo }).foraDoFormato, [dados, ano, mes, comComodo]);
  const anoValido = Number.isInteger(ano) && ano >= 2000 && ano <= 2100;

  async function exportar() {
    setExportando(true);
    setSalvo(null);
    try {
      const opcoes = { ano, mes, comComodo };
      const periodica = planilhaPeriodica(dados, opcoes).grade;
      const diaria = planilhaDiaria(dados, opcoes);
      const blob = await escreverXlsx([
        { nome: 'Esqueleto', grade: periodica, colunas: 13, larguras: { primeira: 43, demais: 10.7 } },
        { nome: 'Diárias e semanais', grade: diaria, colunas: 32, larguras: { primeira: 43, demais: 4.5 } },
        { nome: 'Dados', grade: planilhaDados(dados), colunas: 11, larguras: { primeira: 40, demais: 18 } },
      ]);
      const nomeArquivo = nomeDoArquivoDeTarefas(ano);
      if (destino === 'xlsx') {
        baixarArquivo(blob, nomeArquivo);
        mostrarToast('Planilha exportada.');
        onFechar();
        return;
      }
      const token = await entrarNoGoogle();
      const pasta = await escolherPastaDoDrive(token);
      if (!pasta) {
        mostrarToast('Nenhuma pasta escolhida. A planilha não foi enviada.', 'info');
        return;
      }
      const nomeNoDrive = nomeArquivo.replace(/\.xlsx$/, '');
      const enviado = await enviarComoGoogleSheets(token, pasta.id, nomeNoDrive, blob);
      setSalvo({ nome: nomeNoDrive, pasta: pasta.nome, link: enviado.link });
      mostrarToast('Planilha salva no Google Drive.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setExportando(false);
    }
  }

  return (
    <ModalBase aberto rotulo="Exportar planilha" onFechar={onFechar} classe="modal-edicao">
      <h3 className="modal-titulo">Exportar planilha</h3>
      <p className="settings-secao-ajuda">
        {dados.tarefas.length === 1 ? '1 tarefa' : `${dados.tarefas.length} tarefas`} ({origem}), no formato da aba Esqueleto.
      </p>
      <label>
        Ano
        <input type="number" min={2000} max={2100} value={ano} onChange={(e) => setAno(Number(e.target.value))} />
      </label>
      <label>
        Mês das tarefas diárias, semanais e de a cada 15 dias
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <label className="manutencao-opcao-base">
        <input type="checkbox" checked={comComodo} onChange={(e) => setComComodo(e.target.checked)} />
        Escrever o nome do cômodo na linha da tarefa
      </label>
      <fieldset className="manutencao-destino">
        <legend>Destino</legend>
        <label className="manutencao-opcao-base">
          <input type="radio" name="destino-planilha" checked={destino === 'xlsx'} onChange={() => setDestino('xlsx')} />
          Baixar o arquivo .xlsx (abre no Excel e no Google Sheets)
        </label>
        <label className="manutencao-opcao-base">
          <input type="radio" name="destino-planilha" checked={destino === 'sheets'} onChange={() => setDestino('sheets')} disabled={!driveLigado} />
          Salvar no Google Drive como Google Sheets (escolher a pasta)
        </label>
        {!driveLigado && <p className="hierarquia-vazio">O login do Google ainda não foi configurado neste app. Por enquanto, baixe o .xlsx.</p>}
      </fieldset>
      {foraDoFormato > 0 && (
        <p className="hierarquia-vazio">
          {foraDoFormato === 1 ? '1 tarefa tem' : `${foraDoFormato} tarefas têm`} uma frequência que não cabe em nenhum bloco da planilha e {foraDoFormato === 1 ? 'aparece' : 'aparecem'} só na aba Dados.
        </p>
      )}
      {salvo && (
        <p role="status">
          Salvo em "{salvo.pasta}" como {salvo.nome}.{' '}
          <a href={salvo.link} target="_blank" rel="noopener noreferrer">
            Abrir no Google Sheets
          </a>
        </p>
      )}
      <div className="modal-acoes">
        <button type="button" onClick={exportar} disabled={exportando || !anoValido || dados.tarefas.length === 0} data-autofocus>
          {exportando ? 'Exportando…' : 'Exportar'}
        </button>
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}
