import { useState, type FormEvent } from 'react';
import { IconeSupabase } from '../../components/IconeSupabase';
import { ModalBase } from '../../components/ModalBase';
import { ArquivoLink } from '../../components/ArquivoLink';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import {
  useAtualizarProjeto,
  useCriarProjeto,
  useExcluirProjeto,
  useProjetos,
  type DadosProjeto,
} from '../../hooks/useProjetos';
import { useAdicionarAnexoProjeto, useProjetoAnexos, useRemoverAnexoProjeto } from '../../hooks/useProjetoAnexos';
import type { Projeto, ProjetoAnexo, StatusProjeto } from '../../types';

const PROJETO_VAZIO: DadosProjeto = { nome: '', descricao: null, status: 'planejado', data_inicio: null, data_conclusao: null };

const STATUS_LABEL: Record<StatusProjeto, string> = {
  planejado: 'Planejado',
  andamento: 'Em andamento',
  concluido: 'Concluído',
};

function SecaoAnexos({ projeto }: { projeto: Projeto }) {
  const { data: anexos, isLoading } = useProjetoAnexos(projeto.id);
  const adicionar = useAdicionarAnexoProjeto(projeto.id);
  const remover = useRemoverAnexoProjeto(projeto.id);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!arquivo || !descricao.trim()) {
      mostrarToast('Escreva o que é esse anexo.', 'erro');
      return;
    }
    setEnviando(true);
    try {
      await adicionar.mutateAsync({ arquivo, descricao: descricao.trim() });
      setArquivo(null);
      setDescricao('');
      mostrarToast('Anexo adicionado.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(anexo: ProjetoAnexo) {
    const ok = await confirmar({ titulo: 'Remover anexo?', mensagem: anexo.descricao ?? anexo.nome_arquivo, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    try {
      await remover.mutateAsync(anexo);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="documentos-secao">
      <h4>Anexos</h4>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-documentos">
          {(anexos ?? []).map((anexo) => (
            <li key={anexo.id}>
              <ArquivoLink bucket="projetos-anexos" caminho={anexo.arquivo_url}>
                {anexo.descricao ?? anexo.nome_arquivo}
              </ArquivoLink>
              <button type="button" className="btn-icone btn-icone-perigo" onClick={() => handleRemover(anexo)} aria-label="Remover">
                <IconeSupabase arquivo="trash3.svg" />
              </button>
            </li>
          ))}
          {anexos?.length === 0 && <li className="hierarquia-vazio">Nenhum anexo ainda.</li>}
        </ul>
      )}
      <form className="upload-form" onSubmit={handleUpload}>
        <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} accept="application/pdf,image/*" />
        <input type="text" placeholder="O que é esse arquivo?" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <button type="submit" disabled={!arquivo || enviando}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </form>
    </div>
  );
}

function FormularioProjeto({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosProjeto;
  onSalvar: (dados: DadosProjeto) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosProjeto>(inicial);
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
        <input type="text" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} data-autofocus required />
      </label>
      <label>
        Descrição
        <textarea value={dados.descricao ?? ''} onChange={(e) => setDados({ ...dados, descricao: e.target.value || null })} />
      </label>
      <label>
        Status
        <select value={dados.status} onChange={(e) => setDados({ ...dados, status: e.target.value as StatusProjeto })}>
          {Object.entries(STATUS_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Início
        <input type="date" value={dados.data_inicio ?? ''} onChange={(e) => setDados({ ...dados, data_inicio: e.target.value || null })} />
      </label>
      <label>
        Conclusão
        <input type="date" value={dados.data_conclusao ?? ''} onChange={(e) => setDados({ ...dados, data_conclusao: e.target.value || null })} />
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

export function ProjetosPage() {
  const { data: projetos, isLoading } = useProjetos();
  const criar = useCriarProjeto();
  const atualizar = useAtualizarProjeto();
  const excluir = useExcluirProjeto();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(projeto: Projeto) {
    setEditando(projeto);
    setModalAberto(true);
  }

  async function salvar(dados: DadosProjeto) {
    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, dados });
      } else {
        await criar.mutateAsync(dados);
      }
      mostrarToast('Projeto salvo.');
      if (!editando) setModalAberto(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarExcluir(projeto: Projeto) {
    const ok = await confirmar({
      titulo: `Excluir "${projeto.nome}"?`,
      mensagem: 'Os anexos desse projeto também serão excluídos.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(projeto.id);
      setModalAberto(false);
      mostrarToast('Projeto excluído.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="settings-secao">
      <h2>Projetos do apartamento</h2>
      <button type="button" onClick={abrirNovo}>
        + Projeto
      </button>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(projetos ?? []).map((projeto) => (
            <li key={projeto.id}>
              <div>
                <strong>{projeto.nome}</strong>
                <span className="conta-detalhe">{STATUS_LABEL[projeto.status]}</span>
              </div>
              <button type="button" className="btn-icone" onClick={() => abrirEdicao(projeto)} aria-label="Ver/editar">
                ✎
              </button>
            </li>
          ))}
          {projetos?.length === 0 && <p className="hierarquia-vazio">Nenhum projeto cadastrado ainda.</p>}
        </ul>
      )}
      <ModalBase aberto={modalAberto} rotulo={editando ? editando.nome : 'Novo projeto'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar projeto' : 'Novo projeto'}</h3>
        <FormularioProjeto
          inicial={
            editando
              ? {
                  nome: editando.nome,
                  descricao: editando.descricao,
                  status: editando.status,
                  data_inicio: editando.data_inicio,
                  data_conclusao: editando.data_conclusao,
                }
              : PROJETO_VAZIO
          }
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
        {editando && (
          <>
            <SecaoAnexos projeto={editando} />
            <button type="button" className="botao-perigoso" onClick={() => tratarExcluir(editando)}>
              Excluir projeto
            </button>
          </>
        )}
      </ModalBase>
    </div>
  );
}
