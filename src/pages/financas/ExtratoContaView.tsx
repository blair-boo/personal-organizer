import { useMemo, useState, type FormEvent } from 'react';
import { IconeSupabase } from '../../components/IconeSupabase';
import { ModalBase } from '../../components/ModalBase';
import { CategoriaSelect } from '../../components/CategoriaSelect';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData, formatarMoeda } from '../../lib/datas';
import { normalizarDescricao } from '../../lib/normalizacao';
import { rotuloHierarquico } from '../../lib/hierarquia';
import { useContas } from '../../hooks/useContas';
import { rotuloConta } from '../../lib/contas';
import { useCategorias } from '../../hooks/useCategorias';
import {
  useAtualizarLancamento,
  useCriarLancamento,
  useExcluirLancamento,
  useLancamentosDoMes,
  type DadosLancamento,
} from '../../hooks/useLancamentos';
import { ImportarExtratoModal } from './ImportarExtratoModal';
import type { Lancamento, TipoConta, TipoLancamento } from '../../types';

const LANCAMENTO_VAZIO_BASE = {
  descricao_original: '',
  valor: 0,
  tipo: 'saida' as TipoLancamento,
  categoria_id: null as string | null,
  parcela_atual: null,
  parcela_total: null,
  observacao: null,
};

function FormularioLancamento({
  contaId,
  competencia,
  editando,
  onSalvo,
  onCancelar,
}: {
  contaId: string;
  competencia: string;
  editando: Lancamento | null;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const criar = useCriarLancamento(contaId, competencia);
  const atualizar = useAtualizarLancamento(contaId, competencia);
  const { mostrarToast } = useToast();
  const [dados, setDados] = useState({
    data: editando?.data ?? `${competencia}-01`,
    descricao_original: editando?.descricao_original ?? LANCAMENTO_VAZIO_BASE.descricao_original,
    valor: editando?.valor ?? LANCAMENTO_VAZIO_BASE.valor,
    tipo: editando?.tipo ?? LANCAMENTO_VAZIO_BASE.tipo,
    categoria_id: editando?.categoria_id ?? LANCAMENTO_VAZIO_BASE.categoria_id,
    observacao: editando?.observacao ?? LANCAMENTO_VAZIO_BASE.observacao,
  });
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload: DadosLancamento = {
        conta_id: contaId,
        importacao_id: editando?.importacao_id ?? null,
        data: dados.data,
        descricao_original: dados.descricao_original,
        descricao_normalizada: normalizarDescricao(dados.descricao_original),
        valor: dados.valor,
        tipo: dados.tipo,
        categoria_id: dados.categoria_id,
        parcela_atual: editando?.parcela_atual ?? null,
        parcela_total: editando?.parcela_total ?? null,
        observacao: dados.observacao,
      };
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, dados: payload });
      } else {
        await criar.mutateAsync(payload);
      }
      mostrarToast('Lançamento salvo.');
      onSalvo();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Data
        <input type="date" value={dados.data} onChange={(e) => setDados({ ...dados, data: e.target.value })} required data-autofocus />
      </label>
      <label>
        Descrição
        <input
          type="text"
          value={dados.descricao_original}
          onChange={(e) => setDados({ ...dados, descricao_original: e.target.value })}
          required
        />
      </label>
      <label>
        Valor
        <input type="number" step="0.01" value={dados.valor} onChange={(e) => setDados({ ...dados, valor: Number(e.target.value) || 0 })} required />
      </label>
      <label>
        Tipo
        <select value={dados.tipo} onChange={(e) => setDados({ ...dados, tipo: e.target.value as TipoLancamento, categoria_id: null })}>
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </select>
      </label>
      <label>
        Categoria
        <CategoriaSelect tipoLancamento={dados.tipo} value={dados.categoria_id} onChange={(id) => setDados({ ...dados, categoria_id: id })} />
      </label>
      <label>
        Observação
        <input type="text" value={dados.observacao ?? ''} onChange={(e) => setDados({ ...dados, observacao: e.target.value || null })} />
      </label>
      <div className="modal-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function ExtratoContaView({ competencia, tiposConta }: { competencia: string; tiposConta: TipoConta[] }) {
  const { data: contas } = useContas();
  const { data: categoriasDespesa } = useCategorias('despesa');
  const { data: categoriasReceita } = useCategorias('receita');
  const contasFiltradas = (contas ?? []).filter((c) => tiposConta.includes(c.tipo) && c.status === 'ativo');

  const [contaId, setContaId] = useState<string | null>(null);
  const contaAtual = contasFiltradas.find((c) => c.id === contaId) ?? contasFiltradas[0] ?? null;

  const { data: lancamentos, isLoading } = useLancamentosDoMes(contaAtual?.id ?? null, competencia);
  const excluir = useExcluirLancamento(contaAtual?.id ?? '', competencia);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { rotulo: string; total: number; itens: Lancamento[] }>();
    for (const l of lancamentos ?? []) {
      const categorias = l.tipo === 'entrada' ? categoriasReceita : categoriasDespesa;
      const rotulo = rotuloHierarquico(categorias, l.categoria_id) ?? 'Sem categoria';
      const chave = `${l.tipo}:${l.categoria_id ?? 'sem'}`;
      const grupo = mapa.get(chave) ?? { rotulo, total: 0, itens: [] };
      grupo.total += l.tipo === 'entrada' ? l.valor : -l.valor;
      grupo.itens.push(l);
      mapa.set(chave, grupo);
    }
    return [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  }, [lancamentos, categoriasDespesa, categoriasReceita]);

  const saldo = (lancamentos ?? []).reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

  async function tratarExcluir(l: Lancamento) {
    const ok = await confirmar({ titulo: 'Excluir lançamento?', mensagem: l.descricao_original, confirmarRotulo: 'Excluir', perigoso: true });
    if (!ok) return;
    try {
      await excluir.mutateAsync(l.id);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  if (contasFiltradas.length === 0) {
    return <p className="hierarquia-vazio">Cadastre uma conta em Settings › Contas e Cartões pra começar.</p>;
  }

  return (
    <div className="extrato-view">
      <div className="extrato-topo">
        <select value={contaAtual?.id ?? ''} onChange={(e) => setContaId(e.target.value)}>
          {contasFiltradas.map((c) => (
            <option key={c.id} value={c.id}>
              {rotuloConta(c)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setModalImportarAberto(true)}>
          Importar PDF
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setModalLancamentoAberto(true);
          }}
        >
          + Lançamento manual
        </button>
      </div>

      {isLoading ? (
        <p>Carregando…</p>
      ) : (lancamentos?.length ?? 0) === 0 ? (
        <p className="hierarquia-vazio">Nenhum lançamento neste mês ainda.</p>
      ) : (
        <>
          <p className="extrato-saldo">Saldo do mês: {formatarMoeda(saldo)}</p>
          {grupos.map((grupo) => (
            <div key={grupo.rotulo} className="extrato-grupo">
              <div className="extrato-grupo-cabecalho">
                <strong>{grupo.rotulo}</strong>
                <span>{formatarMoeda(grupo.total)}</span>
              </div>
              <ul className="lista-lancamentos">
                {grupo.itens.map((l) => (
                  <li key={l.id}>
                    <div>
                      <span>{formatarData(l.data)}</span> — {l.descricao_original}
                      {l.parcela_total && ` (${l.parcela_atual}/${l.parcela_total})`}
                    </div>
                    <div className="extrato-lancamento-acoes">
                      <span className={l.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}>{formatarMoeda(l.valor)}</span>
                      <button
                        type="button"
                        className="btn-icone"
                        onClick={() => {
                          setEditando(l);
                          setModalLancamentoAberto(true);
                        }}
                        aria-label="Editar"
                      >
                        ✎
                      </button>
                      <button type="button" className="btn-icone btn-icone-perigo" onClick={() => tratarExcluir(l)} aria-label="Excluir">
                        <IconeSupabase arquivo="trash3.svg" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {contaAtual && (
        <ModalBase
          aberto={modalLancamentoAberto}
          rotulo={editando ? 'Editar lançamento' : 'Novo lançamento'}
          onFechar={() => setModalLancamentoAberto(false)}
          classe="modal-edicao"
        >
          <h3 className="modal-titulo">{editando ? 'Editar lançamento' : 'Novo lançamento'}</h3>
          <FormularioLancamento
            contaId={contaAtual.id}
            competencia={competencia}
            editando={editando}
            onSalvo={() => setModalLancamentoAberto(false)}
            onCancelar={() => setModalLancamentoAberto(false)}
          />
        </ModalBase>
      )}

      {contaAtual && (
        <ImportarExtratoModal
          aberto={modalImportarAberto}
          conta={contaAtual}
          competencia={competencia}
          onFechar={() => setModalImportarAberto(false)}
          onConcluido={() => setModalImportarAberto(false)}
        />
      )}
    </div>
  );
}
