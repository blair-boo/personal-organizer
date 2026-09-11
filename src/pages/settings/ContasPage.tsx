import { useState, type FormEvent } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { useAtualizarConta, useContas, useCriarConta, useExcluirConta, type DadosConta } from '../../hooks/useContas';
import type { Conta, TipoConta } from '../../types';

const TIPO_CONTA_INFO: Record<TipoConta, { label: string; sigla: string }> = {
  conta_corrente: { label: 'Conta corrente', sigla: 'cc' },
  conta_poupanca: { label: 'Conta poupança', sigla: 'cp' },
  conta_investimento: { label: 'Conta investimento', sigla: 'ci' },
  cartao_credito: { label: 'Cartão de crédito', sigla: '—' },
};

const CONTA_VAZIA: DadosConta = { nome: '', tipo: 'conta_corrente', instituicao: '', cor: null, ativo: true };

function FormularioConta({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosConta;
  onSalvar: (dados: DadosConta) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosConta>(inicial);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(dados);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nome
        <input
          type="text"
          value={dados.nome}
          onChange={(e) => setDados({ ...dados, nome: e.target.value })}
          data-autofocus
          required
        />
      </label>
      <label>
        Tipo
        <select value={dados.tipo} onChange={(e) => setDados({ ...dados, tipo: e.target.value as TipoConta })}>
          {Object.entries(TIPO_CONTA_INFO).map(([valor, info]) => (
            <option key={valor} value={valor}>
              {info.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Instituição (banco)
        <input
          type="text"
          value={dados.instituicao}
          onChange={(e) => setDados({ ...dados, instituicao: e.target.value })}
          required
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={dados.ativo}
          onChange={(e) => setDados({ ...dados, ativo: e.target.checked })}
        />
        Ativa
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

export function ContasPage() {
  const { data: contas, isLoading } = useContas();
  const criar = useCriarConta();
  const atualizar = useAtualizarConta();
  const excluir = useExcluirConta();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);

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
      titulo: `Excluir "${conta.nome}"?`,
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

  return (
    <div className="settings-secao">
      <h2>Contas e cartões</h2>
      <button type="button" onClick={abrirNova}>
        + Conta ou cartão
      </button>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(contas ?? []).map((conta) => (
            <li key={conta.id} className={conta.ativo ? '' : 'conta-inativa'}>
              <div>
                <strong>{conta.nome}</strong>
                <span className="conta-detalhe">
                  {TIPO_CONTA_INFO[conta.tipo].label} · {conta.instituicao}
                  {!conta.ativo && ' · inativa'}
                </span>
              </div>
              <div className="hierarquia-item-acoes">
                <button type="button" className="btn-icone" onClick={() => abrirEdicao(conta)} aria-label="Editar">
                  ✎
                </button>
                <button
                  type="button"
                  className="btn-icone btn-icone-perigo"
                  onClick={() => tratarExcluir(conta)}
                  aria-label="Excluir"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
          {contas?.length === 0 && <p className="hierarquia-vazio">Nenhuma conta cadastrada ainda.</p>}
        </ul>
      )}
      <ModalBase aberto={modalAberto} rotulo={editando ? 'Editar conta' : 'Nova conta'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar conta' : 'Nova conta'}</h3>
        <FormularioConta
          inicial={editando ? { nome: editando.nome, tipo: editando.tipo, instituicao: editando.instituicao, cor: editando.cor, ativo: editando.ativo } : CONTA_VAZIA}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
      </ModalBase>
    </div>
  );
}
