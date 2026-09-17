import { useState, type FormEvent } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { IconeSupabase } from '../../components/IconeSupabase';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { copiarConteudo } from '../../lib/clipboard';
import {
  useAtualizarPessoasFeed,
  useCalendarioFeeds,
  useCriarCalendarioFeed,
  useExcluirCalendarioFeed,
  useGerarNovoTokenFeed,
  useRenomearCalendarioFeed,
  urlFeedCalendario,
} from '../../hooks/useCalendarioDocumentos';
import { useDocumentosPessoas } from '../../hooks/useDocumentos';
import type { CalendarioFeed, PessoaDocumentos } from '../../types';

function nomesPessoas(feed: CalendarioFeed): string {
  return feed.pessoas.length === 0 ? 'Todas as pessoas' : feed.pessoas.map((p) => p.nome).join(', ');
}

function FormularioFeed({
  inicial,
  pessoas,
  onSalvar,
  onCancelar,
  salvando,
}: {
  inicial: { nome: string; pessoaIds: string[] };
  pessoas: PessoaDocumentos[];
  onSalvar: (dados: { nome: string; pessoaIds: string[] }) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [nome, setNome] = useState(inicial.nome);
  const [todas, setTodas] = useState(inicial.pessoaIds.length === 0);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(inicial.pessoaIds));

  function alternarPessoa(id: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || (!todas && selecionadas.size === 0)) return;
    onSalvar({ nome: nome.trim(), pessoaIds: todas ? [] : [...selecionadas] });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nome
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus required />
      </label>
      <label className="calendario-checkbox-linha">
        <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
        Todas as pessoas
      </label>
      {!todas && (
        <div className="calendario-pessoas-lista">
          {pessoas.map((p) => (
            <label key={p.id} className="calendario-checkbox-linha">
              <input type="checkbox" checked={selecionadas.has(p.id)} onChange={() => alternarPessoa(p.id)} />
              {p.nome}
            </label>
          ))}
          {pessoas.length === 0 && <p className="hierarquia-vazio">Nenhuma pessoa cadastrada em Documentos ainda.</p>}
        </div>
      )}
      <div className="modal-acoes">
        <button type="submit" disabled={salvando || !nome.trim() || (!todas && selecionadas.size === 0)}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function CalendarioPage() {
  const { data: feeds, isLoading } = useCalendarioFeeds();
  const { data: pessoas } = useDocumentosPessoas();
  const criar = useCriarCalendarioFeed();
  const atualizarPessoas = useAtualizarPessoasFeed();
  const renomear = useRenomearCalendarioFeed();
  const gerarNovoToken = useGerarNovoTokenFeed();
  const excluir = useExcluirCalendarioFeed();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [feedEditando, setFeedEditando] = useState<CalendarioFeed | null>(null);
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setFeedEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(feed: CalendarioFeed) {
    setFeedEditando(feed);
    setModalAberto(true);
  }

  async function salvar(dados: { nome: string; pessoaIds: string[] }) {
    setSalvando(true);
    try {
      if (feedEditando) {
        if (dados.nome !== feedEditando.nome) {
          await renomear.mutateAsync({ id: feedEditando.id, nome: dados.nome });
        }
        await atualizarPessoas.mutateAsync({ feedId: feedEditando.id, pessoaIds: dados.pessoaIds });
      } else {
        await criar.mutateAsync(dados);
      }
      mostrarToast('Link salvo.');
      setModalAberto(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarLink(feed: CalendarioFeed) {
    await copiarConteudo(urlFeedCalendario(feed.token), mostrarToast, `link de ${feed.nome}`);
  }

  async function handleGerarNovoToken(feed: CalendarioFeed) {
    const ok = await confirmar({
      titulo: `Gerar nova URL pra "${feed.nome}"?`,
      mensagem: 'O link atual desse link para de funcionar. Quem já assinou precisa assinar de novo com a URL nova.',
      confirmarRotulo: 'Gerar nova URL',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await gerarNovoToken.mutateAsync(feed.id);
      mostrarToast('Nova URL gerada.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function handleExcluir(feed: CalendarioFeed) {
    const ok = await confirmar({
      titulo: `Excluir o link "${feed.nome}"?`,
      mensagem: 'Quem já assinou esse link para de receber atualizações dele. Essa ação não pode ser desfeita.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(feed.id);
      mostrarToast('Link excluído.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="settings-secao">
      <h2>Calendário</h2>
      <p className="settings-secao-ajuda">
        Links de assinatura (.ics) com os vencimentos de Documentos Pessoais, pro Calendário do iPhone ou Google
        Calendar. Cada link pode trazer todo mundo ou só pessoas específicas, e dá pra mudar quem está incluído
        depois sem trocar a URL — ou gerar uma URL nova se precisar invalidar a antiga.
      </p>
      <div className="hierarquia-topo">
        <button type="button" onClick={abrirNovo}>
          + Novo link
        </button>
      </div>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(feeds ?? []).map((feed) => (
            <li key={feed.id}>
              <div>
                <strong>{feed.nome}</strong>
                <span className="conta-detalhe">{nomesPessoas(feed)}</span>
              </div>
              <div className="hierarquia-item-acoes">
                <button type="button" onClick={() => copiarLink(feed)}>
                  Copiar link
                </button>
                <button type="button" onClick={() => abrirEdicao(feed)}>
                  Editar
                </button>
                <button type="button" onClick={() => handleGerarNovoToken(feed)}>
                  Gerar nova URL
                </button>
                <button
                  type="button"
                  className="btn-icone btn-icone-perigo"
                  onClick={() => handleExcluir(feed)}
                  title={`Excluir ${feed.nome}`}
                  aria-label={`Excluir ${feed.nome}`}
                >
                  <IconeSupabase arquivo="trash3.svg" />
                </button>
              </div>
            </li>
          ))}
          {feeds?.length === 0 && <p className="hierarquia-vazio">Nenhum link criado ainda.</p>}
        </ul>
      )}
      <ModalBase
        aberto={modalAberto}
        rotulo={feedEditando ? feedEditando.nome : 'Novo link'}
        onFechar={() => setModalAberto(false)}
        classe="modal-edicao"
      >
        <h3 className="modal-titulo">{feedEditando ? 'Editar link' : 'Novo link'}</h3>
        <FormularioFeed
          key={feedEditando?.id ?? 'novo'}
          inicial={
            feedEditando
              ? { nome: feedEditando.nome, pessoaIds: feedEditando.pessoas.map((p) => p.id) }
              : { nome: '', pessoaIds: [] }
          }
          pessoas={pessoas ?? []}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
          salvando={salvando}
        />
      </ModalBase>
    </div>
  );
}
