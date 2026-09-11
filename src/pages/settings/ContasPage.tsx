import { useState, type FormEvent } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarMoeda } from '../../lib/datas';
import { ehCartao, rotuloConta, TIPO_CONTA_INFO } from '../../lib/contas';
import { useAtualizarConta, useContas, useCriarConta, useExcluirConta, type DadosConta } from '../../hooks/useContas';
import type { Conta, FormatoCartao, StatusConta, SubtipoVirtualCartao, TipoConta } from '../../types';

const CONTA_VAZIA: DadosConta = {
  nome: null,
  tipo: 'conta_corrente',
  instituicao: '',
  cor: null,
  status: 'ativo',
  conta_vinculada_id: null,
  emissora: null,
  ultimos_4_digitos: null,
  formato: null,
  subtipo_virtual: null,
  valor_deposito_mensal: null,
  dia_deposito: null,
};

const STATUS_LABEL: Record<StatusConta, string> = {
  ativo: 'Ativa',
  inativo: 'Inativa',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

function FormularioConta({
  inicial,
  contasBancarias,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosConta;
  contasBancarias: Conta[];
  onSalvar: (dados: DadosConta) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosConta>(inicial);
  const [salvando, setSalvando] = useState(false);
  const cartao = ehCartao(dados.tipo);
  const statusOpcoes: StatusConta[] = cartao ? ['ativo', 'cancelado', 'expirado'] : ['ativo', 'inativo'];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(dados);
    } finally {
      setSalvando(false);
    }
  }

  function mudarTipo(tipo: TipoConta) {
    const novoCartao = ehCartao(tipo);
    setDados((d) => ({
      ...d,
      tipo,
      status: novoCartao ? (statusOpcoes.includes(d.status) ? d.status : 'ativo') : d.status === 'ativo' || d.status === 'inativo' ? d.status : 'ativo',
      conta_vinculada_id: tipo === 'cartao_credito' ? d.conta_vinculada_id : null,
      valor_deposito_mensal: tipo === 'cartao_beneficio' ? d.valor_deposito_mensal : null,
      dia_deposito: tipo === 'cartao_beneficio' ? d.dia_deposito : null,
    }));
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Tipo
        <select value={dados.tipo} onChange={(e) => mudarTipo(e.target.value as TipoConta)}>
          {Object.entries(TIPO_CONTA_INFO).map(([valor, info]) => (
            <option key={valor} value={valor}>
              {info.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Apelido (opcional)
        <input
          type="text"
          value={dados.nome ?? ''}
          onChange={(e) => setDados({ ...dados, nome: e.target.value || null })}
          placeholder={cartao ? 'ex.: Cartão da viagem' : 'ex.: Conta do salário'}
        />
      </label>
      <label>
        Instituição (banco/emissor)
        <input
          type="text"
          value={dados.instituicao}
          onChange={(e) => setDados({ ...dados, instituicao: e.target.value })}
          required
        />
      </label>

      {cartao && (
        <>
          <label>
            Bandeira (emissora)
            <input
              type="text"
              value={dados.emissora ?? ''}
              onChange={(e) => setDados({ ...dados, emissora: e.target.value || null })}
              placeholder="Mastercard, Visa, Elo…"
            />
          </label>
          <label>
            4 últimos dígitos
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={dados.ultimos_4_digitos ?? ''}
              onChange={(e) => setDados({ ...dados, ultimos_4_digitos: e.target.value.replace(/\D/g, '').slice(0, 4) || null })}
            />
          </label>
          <label>
            Formato
            <select
              value={dados.formato ?? ''}
              onChange={(e) => setDados({ ...dados, formato: (e.target.value || null) as FormatoCartao | null, subtipo_virtual: null })}
            >
              <option value="">Não informado</option>
              <option value="fisico">Físico</option>
              <option value="virtual">Virtual</option>
            </select>
          </label>
          {dados.formato === 'virtual' && (
            <label>
              Cartão virtual
              <select
                value={dados.subtipo_virtual ?? ''}
                onChange={(e) => setDados({ ...dados, subtipo_virtual: (e.target.value || null) as SubtipoVirtualCartao | null })}
              >
                <option value="">Não informado</option>
                <option value="recorrente">Recorrente</option>
                <option value="expiravel">Expirável</option>
              </select>
            </label>
          )}
        </>
      )}

      {dados.tipo === 'cartao_credito' && (
        <label>
          Conta que paga a fatura
          <select
            value={dados.conta_vinculada_id ?? ''}
            onChange={(e) => setDados({ ...dados, conta_vinculada_id: e.target.value || null })}
          >
            <option value="">Não vinculado</option>
            {contasBancarias.map((c) => (
              <option key={c.id} value={c.id}>
                {rotuloConta(c)}
              </option>
            ))}
          </select>
        </label>
      )}

      {dados.tipo === 'cartao_beneficio' && (
        <>
          <label>
            Valor do depósito mensal
            <input
              type="number"
              step="0.01"
              value={dados.valor_deposito_mensal ?? ''}
              onChange={(e) => setDados({ ...dados, valor_deposito_mensal: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          <label>
            Dia do depósito
            <input
              type="number"
              min={1}
              max={31}
              value={dados.dia_deposito ?? ''}
              onChange={(e) => setDados({ ...dados, dia_deposito: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
        </>
      )}

      <label>
        Status
        <select value={dados.status} onChange={(e) => setDados({ ...dados, status: e.target.value as StatusConta })}>
          {statusOpcoes.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
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

function detalheConta(conta: Conta): string {
  const partes = [TIPO_CONTA_INFO[conta.tipo].label, conta.instituicao];
  if (conta.status !== 'ativo') partes.push(STATUS_LABEL[conta.status]);
  return partes.join(' · ');
}

export function ContasPage() {
  const { data: contas, isLoading } = useContas();
  const criar = useCriarConta();
  const atualizar = useAtualizarConta();
  const excluir = useExcluirConta();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [cartoesAbertos, setCartoesAbertos] = useState(false);

  const contasBancarias = (contas ?? []).filter((c) => !ehCartao(c.tipo));
  const cartoes = (contas ?? []).filter((c) => ehCartao(c.tipo));

  function abrirNova() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(conta: Conta) {
    setEditando(conta);
    setModalAberto(true);
  }

  async function salvar(dados: DadosConta) {
    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, dados });
      } else {
        await criar.mutateAsync(dados);
      }
      setModalAberto(false);
      mostrarToast('Conta salva.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarExcluir(conta: Conta) {
    const ok = await confirmar({
      titulo: `Excluir "${rotuloConta(conta)}"?`,
      mensagem: 'Todos os lançamentos e importações dessa conta também serão excluídos.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(conta.id);
      mostrarToast('Conta excluída.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function linhaConta(conta: Conta) {
    return (
      <li key={conta.id} className={conta.status === 'ativo' ? '' : 'conta-inativa'}>
        <div>
          <strong>{rotuloConta(conta)}</strong>
          <span className="conta-detalhe">
            {detalheConta(conta)}
            {conta.tipo === 'cartao_beneficio' && conta.valor_deposito_mensal != null && (
              <> · {formatarMoeda(conta.valor_deposito_mensal)}/mês, dia {conta.dia_deposito}</>
            )}
            {conta.tipo === 'cartao_credito' && conta.conta_vinculada_id && (
              <> · fatura paga por {rotuloConta((contas ?? []).find((c) => c.id === conta.conta_vinculada_id)!)}</>
            )}
          </span>
        </div>
        <div className="hierarquia-item-acoes">
          <button type="button" className="btn-icone" onClick={() => abrirEdicao(conta)} aria-label="Editar">
            ✎
          </button>
          <button type="button" className="btn-icone btn-icone-perigo" onClick={() => tratarExcluir(conta)} aria-label="Excluir">
            🗑
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="settings-secao">
      <h2>Contas e cartões</h2>
      <button type="button" onClick={abrirNova}>
        + Conta ou cartão
      </button>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <>
          <ul className="lista-contas">
            {contasBancarias.map(linhaConta)}
            {contasBancarias.length === 0 && <p className="hierarquia-vazio">Nenhuma conta cadastrada ainda.</p>}
          </ul>

          <details className="cartoes-recolhivel" open={cartoesAbertos} onToggle={(e) => setCartoesAbertos(e.currentTarget.open)}>
            <summary>Cartões ({cartoes.length})</summary>
            <ul className="lista-contas">
              {cartoes.map(linhaConta)}
              {cartoes.length === 0 && <p className="hierarquia-vazio">Nenhum cartão cadastrado ainda.</p>}
            </ul>
          </details>
        </>
      )}
      <ModalBase aberto={modalAberto} rotulo={editando ? 'Editar conta' : 'Nova conta'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar conta' : 'Nova conta'}</h3>
        <FormularioConta
          inicial={
            editando
              ? {
                  nome: editando.nome,
                  tipo: editando.tipo,
                  instituicao: editando.instituicao,
                  cor: editando.cor,
                  status: editando.status,
                  conta_vinculada_id: editando.conta_vinculada_id,
                  emissora: editando.emissora,
                  ultimos_4_digitos: editando.ultimos_4_digitos,
                  formato: editando.formato,
                  subtipo_virtual: editando.subtipo_virtual,
                  valor_deposito_mensal: editando.valor_deposito_mensal,
                  dia_deposito: editando.dia_deposito,
                }
              : CONTA_VAZIA
          }
          contasBancarias={contasBancarias}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
      </ModalBase>
    </div>
  );
}
