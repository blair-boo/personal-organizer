import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { CategoriaSelect } from '../../components/CategoriaSelect';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { extrairTextoPdf } from '../../lib/pdfTexto';
import { parseLinhasExtrato, type LancamentoCandidato } from '../../lib/parserExtrato';
import { normalizarDescricao } from '../../lib/normalizacao';
import { caminhoComprovante, enviarArquivo } from '../../lib/storage';
import { competenciaParaSigla, formatarMoeda } from '../../lib/datas';
import { useCriarImportacao, useConcluirImportacao } from '../../hooks/useImportacoes';
import { useCriarLancamentosEmLote, type DadosLancamento } from '../../hooks/useLancamentos';
import { useRegrasPara, useSalvarRegra } from '../../hooks/useRegrasCategorizacao';
import type { Conta } from '../../types';

interface LinhaRevisao extends LancamentoCandidato {
  id: number;
  categoriaId: string | null;
  incluir: boolean;
}

export function ImportarExtratoModal({
  aberto,
  conta,
  competencia,
  onFechar,
  onConcluido,
}: {
  aberto: boolean;
  conta: Conta;
  competencia: string;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const { mostrarToast } = useToast();
  const criarImportacao = useCriarImportacao();
  const concluirImportacao = useConcluirImportacao();
  const criarLancamentos = useCriarLancamentosEmLote(conta.id, competencia);
  const salvarRegra = useSalvarRegra();

  const [etapa, setEtapa] = useState<'selecionar' | 'revisao'>('selecionar');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [salvando, setSalvando] = useState(false);

  const descricoesNormalizadas = linhas.map((l) => normalizarDescricao(l.descricaoOriginal));
  const { data: regras } = useRegrasPara(descricoesNormalizadas);

  function fecharTudo() {
    setEtapa('selecionar');
    setArquivo(null);
    setLinhas([]);
    onFechar();
  }

  async function processarArquivo() {
    if (!arquivo) return;
    setProcessando(true);
    try {
      const texto = await extrairTextoPdf(arquivo);
      const anoReferencia = Number(competencia.split('-')[0]);
      const candidatos = parseLinhasExtrato(texto, {
        anoReferencia,
        contaEhCartao: conta.tipo === 'cartao_credito',
      });
      if (candidatos.length === 0) {
        mostrarToast('Não consegui reconhecer nenhum lançamento nesse PDF. Você pode lançar manualmente.', 'erro');
        return;
      }
      setLinhas(
        candidatos.map((c, i) => ({ ...c, id: i, categoriaId: null, incluir: true }))
      );
      setEtapa('revisao');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setProcessando(false);
    }
  }

  function atualizarLinha(id: number, patch: Partial<LinhaRevisao>) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function confirmarImportacao() {
    if (!arquivo) return;
    setSalvando(true);
    try {
      const prefixo = conta.tipo === 'cartao_credito' ? 'fatura' : 'extrato';
      const caminho = caminhoComprovante(conta.id, prefixo, conta.instituicao, competenciaParaSigla(competencia), arquivo);
      await enviarArquivo('comprovantes', caminho, arquivo);
      const importacao = await criarImportacao.mutateAsync({
        contaId: conta.id,
        competencia,
        nomeArquivo: arquivo.name,
        arquivoUrl: caminho,
      });

      const incluidas = linhas.filter((l) => l.incluir);
      const dados: DadosLancamento[] = incluidas.map((l) => ({
        conta_id: conta.id,
        importacao_id: importacao.id,
        data: l.data,
        descricao_original: l.descricaoOriginal,
        descricao_normalizada: normalizarDescricao(l.descricaoOriginal),
        valor: l.valor,
        tipo: l.tipo,
        categoria_id: l.categoriaId,
        parcela_atual: l.parcelaAtual,
        parcela_total: l.parcelaTotal,
        observacao: null,
      }));
      await criarLancamentos.mutateAsync(dados);

      for (const l of incluidas) {
        if (l.categoriaId) {
          await salvarRegra(normalizarDescricao(l.descricaoOriginal), l.categoriaId);
        }
      }

      await concluirImportacao.mutateAsync(importacao.id);
      mostrarToast(`${incluidas.length} lançamento(s) importado(s).`);
      onConcluido();
      fecharTudo();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const semCategoria = linhas.filter((l) => l.incluir && !l.categoriaId && !regras?.get(normalizarDescricao(l.descricaoOriginal))).length;

  return (
    <ModalBase aberto={aberto} rotulo="Importar extrato/fatura" onFechar={fecharTudo} classe="modal-importacao">
      <h3 className="modal-titulo">Importar {conta.tipo === 'cartao_credito' ? 'fatura' : 'extrato'} — {conta.nome}</h3>

      {etapa === 'selecionar' && (
        <div className="importar-selecionar">
          <p className="settings-secao-ajuda">
            Envie o PDF da {conta.tipo === 'cartao_credito' ? 'fatura' : 'extrato'}. O app tenta reconhecer as linhas
            automaticamente — você revisa e corrige antes de salvar.
          </p>
          <input type="file" accept="application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          <div className="modal-acoes">
            <button type="button" onClick={processarArquivo} disabled={!arquivo || processando}>
              {processando ? 'Lendo PDF…' : 'Ler PDF'}
            </button>
            <button type="button" onClick={fecharTudo}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {etapa === 'revisao' && (
        <div className="importar-revisao">
          <p className="settings-secao-ajuda">
            {linhas.length} linha(s) encontrada(s). {semCategoria > 0 ? `${semCategoria} sem categoria ainda.` : 'Todas categorizadas.'}
          </p>
          <div className="tabela-revisao-wrap">
            <table className="tabela-revisao">
              <thead>
                <tr>
                  <th></th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const descNorm = normalizarDescricao(l.descricaoOriginal);
                  const categoriaEfetiva = l.categoriaId ?? regras?.get(descNorm) ?? null;
                  return (
                    <tr key={l.id} className={l.incluir ? '' : 'linha-excluida'}>
                      <td>
                        <input
                          type="checkbox"
                          checked={l.incluir}
                          onChange={(e) => atualizarLinha(l.id, { incluir: e.target.checked })}
                          aria-label="Incluir"
                        />
                      </td>
                      <td>
                        <input type="date" value={l.data} onChange={(e) => atualizarLinha(l.id, { data: e.target.value })} />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={l.descricaoOriginal}
                          onChange={(e) => atualizarLinha(l.id, { descricaoOriginal: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={l.valor}
                          onChange={(e) => atualizarLinha(l.id, { valor: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <select value={l.tipo} onChange={(e) => atualizarLinha(l.id, { tipo: e.target.value as LinhaRevisao['tipo'] })}>
                          <option value="entrada">Entrada</option>
                          <option value="saida">Saída</option>
                        </select>
                      </td>
                      <td>
                        <CategoriaSelect tipoLancamento={l.tipo} value={categoriaEfetiva} onChange={(id) => atualizarLinha(l.id, { categoriaId: id })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="settings-secao-ajuda">
            Total incluído: {formatarMoeda(linhas.filter((l) => l.incluir).reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0))}
          </p>
          <div className="modal-acoes">
            <button type="button" onClick={confirmarImportacao} disabled={salvando}>
              {salvando ? 'Salvando…' : `Importar ${linhas.filter((l) => l.incluir).length} lançamento(s)`}
            </button>
            <button type="button" onClick={() => setEtapa('selecionar')}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  );
}
