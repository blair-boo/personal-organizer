import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ModalBase } from '../../components/ModalBase';
import { ArquivoLink, BotaoBaixarArquivo } from '../../components/ArquivoLink';
import { IconeSupabase } from '../../components/IconeSupabase';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { copiarConteudo } from '../../lib/clipboard';
import { caminhoAnexoDocumento, enviarArquivo, removerArquivo } from '../../lib/storage';
import {
  BUCKET_CONFIDENCIAL,
  useAdicionarAnexoDocumento,
  useCriarDocumentoCompleto,
  useDocumentoAnexos,
  useDocumentoCampos,
  useDocumentos,
  useExcluirDocumento,
  useRemoverAnexoDocumento,
  useRenomearDocumento,
  useReordenarDocumentos,
  useSalvarCamposDocumento,
  type AnexoParaSalvar,
  type DadosCampoDocumento,
} from '../../hooks/useDocumentos';
import type { AreaDocumento, Documento, DocumentoAnexo, DocumentoCampo } from '../../types';

const SUBPASTA_DOCUMENTOS = 'documentos-pessoais';
const EXPIRACAO_URL_SEGUNDOS = 60;

const AREA_LABEL: Record<AreaDocumento, string> = {
  pessoais: 'Pessoais',
  apartamento: 'Apartamento',
  arquivo: 'Arquivo',
  outros: 'Outros',
};

interface LinhaCampo {
  chave: string;
  nome: string;
  conteudo: string;
  copiavel: boolean;
}

function novaLinhaCampo(): LinhaCampo {
  return { chave: crypto.randomUUID(), nome: '', conteudo: '', copiavel: true };
}

function EditorCampos({ campos, onChange }: { campos: LinhaCampo[]; onChange: (campos: LinhaCampo[]) => void }) {
  function atualizar(chave: string, patch: Partial<LinhaCampo>) {
    onChange(campos.map((c) => (c.chave === chave ? { ...c, ...patch } : c)));
  }
  function remover(chave: string) {
    onChange(campos.filter((c) => c.chave !== chave));
  }
  return (
    <div className="documentos-campos-editor">
      {campos.map((campo) => (
        <div key={campo.chave} className="documentos-campo-linha">
          <input
            type="text"
            placeholder="Nome do campo"
            value={campo.nome}
            onChange={(e) => atualizar(campo.chave, { nome: e.target.value })}
          />
          <input
            type="text"
            placeholder="Conteúdo do campo"
            value={campo.conteudo}
            onChange={(e) => atualizar(campo.chave, { conteudo: e.target.value })}
          />
          <button
            type="button"
            className="btn-icone"
            style={{ opacity: campo.copiavel ? 1 : 0.45 }}
            aria-pressed={campo.copiavel}
            onClick={() => atualizar(campo.chave, { copiavel: !campo.copiavel })}
            title={campo.copiavel ? 'Tem botão de copiar' : 'Sem botão de copiar'}
            aria-label={campo.copiavel ? 'Desativar botão de copiar deste campo' : 'Ativar botão de copiar deste campo'}
          >
            <IconeSupabase arquivo="save.svg" />
          </button>
          <button
            type="button"
            className="btn-icone btn-icone-perigo"
            onClick={() => remover(campo.chave)}
            title="Remover campo"
            aria-label={`Remover campo ${campo.nome || 'sem nome'}`}
          >
            <IconeSupabase arquivo="trash3.svg" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...campos, novaLinhaCampo()])}>
        + Campo
      </button>
    </div>
  );
}

function ExibicaoCampos({ campos }: { campos: DocumentoCampo[] }) {
  const { mostrarToast } = useToast();
  if (campos.length === 0) return null;
  return (
    <div className="documentos-campos-exibicao">
      {campos.map((campo) => (
        <div key={campo.id} className="documentos-campo-exibicao-linha">
          <span>
            <strong>{campo.nome}:</strong> {campo.conteudo || '—'}
          </span>
          {campo.copiavel && campo.conteudo && (
            <button
              type="button"
              className="btn-icone"
              onClick={() => copiarConteudo(campo.conteudo ?? '', mostrarToast, campo.nome)}
              title={`Copiar conteúdo de ${campo.nome}`}
              aria-label={`Copiar conteúdo de ${campo.nome}`}
            >
              <IconeSupabase arquivo="save.svg" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ExibicaoAnexos({ anexos }: { anexos: DocumentoAnexo[] }) {
  return (
    <div className="documentos-secao">
      <h4>Arquivos:</h4>
      <ul className="lista-documentos">
        {anexos.map((anexo) => (
          <li key={anexo.id}>
            <span>{anexo.nome}</span>
            <span className="documentos-anexo-acoes">
              <ArquivoLink bucket={BUCKET_CONFIDENCIAL} caminho={anexo.arquivo_url} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}>
                Visualizar
              </ArquivoLink>
              <BotaoBaixarArquivo
                bucket={BUCKET_CONFIDENCIAL}
                caminho={anexo.arquivo_url}
                nomeArquivo={anexo.nome_arquivo}
                expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}
              />
            </span>
          </li>
        ))}
        {anexos.length === 0 && <li className="hierarquia-vazio">Nenhum anexo ainda.</li>}
      </ul>
    </div>
  );
}

/** Bloco de anexos (Padrão B) pra um documento já salvo: upload/remoção imediatos. */
function SecaoAnexosDocumento({ documentoId }: { documentoId: string }) {
  const { data: anexos, isLoading } = useDocumentoAnexos(documentoId);
  const adicionar = useAdicionarAnexoDocumento(documentoId);
  const remover = useRemoverAnexoDocumento(documentoId);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!arquivo || !nome.trim()) return;
    setEnviando(true);
    try {
      await adicionar.mutateAsync({ arquivo, nome: nome.trim() });
      setArquivo(null);
      setNome('');
      mostrarToast('Anexo adicionado.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(anexo: DocumentoAnexo) {
    const ok = await confirmar({ titulo: 'Remover anexo?', mensagem: anexo.nome, confirmarRotulo: 'Remover', perigoso: true });
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
              <span>{anexo.nome}</span>
              <span className="documentos-anexo-acoes">
                <ArquivoLink bucket={BUCKET_CONFIDENCIAL} caminho={anexo.arquivo_url} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}>
                  Visualizar
                </ArquivoLink>
                <BotaoBaixarArquivo
                  bucket={BUCKET_CONFIDENCIAL}
                  caminho={anexo.arquivo_url}
                  nomeArquivo={anexo.nome_arquivo}
                  expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}
                />
                <button type="button" className="btn-icone btn-icone-perigo" onClick={() => handleRemover(anexo)} title="Remover anexo" aria-label={`Remover anexo ${anexo.nome}`}>
                  <IconeSupabase arquivo="trash3.svg" />
                </button>
              </span>
            </li>
          ))}
          {anexos?.length === 0 && <li className="hierarquia-vazio">Nenhum anexo ainda.</li>}
        </ul>
      )}
      <div className="upload-form">
        <input type="text" placeholder="Nome do arquivo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} accept="application/pdf,image/*" />
        <button type="button" onClick={enviar} disabled={!arquivo || !nome.trim() || enviando}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </div>
    </div>
  );
}

interface AnexoPendente {
  chave: string;
  nome: string;
  caminho: string;
  nomeArquivo: string;
}

/** Bloco de anexos (Padrão B) durante a criação: envia pro Storage na hora, mas só grava no banco quando o documento inteiro for salvo. */
function SecaoAnexosPendentes({
  documentoId,
  anexos,
  onChange,
}: {
  documentoId: string;
  anexos: AnexoPendente[];
  onChange: (anexos: AnexoPendente[]) => void;
}) {
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!arquivo || !nome.trim()) return;
    setEnviando(true);
    try {
      const caminho = caminhoAnexoDocumento(SUBPASTA_DOCUMENTOS, documentoId, nome.trim(), arquivo);
      await enviarArquivo(BUCKET_CONFIDENCIAL, caminho, arquivo);
      onChange([...anexos, { chave: crypto.randomUUID(), nome: nome.trim(), caminho, nomeArquivo: arquivo.name }]);
      setArquivo(null);
      setNome('');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(anexo: AnexoPendente) {
    const ok = await confirmar({ titulo: 'Remover anexo?', mensagem: anexo.nome, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    try {
      await removerArquivo(BUCKET_CONFIDENCIAL, anexo.caminho);
      onChange(anexos.filter((a) => a.chave !== anexo.chave));
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="documentos-secao">
      <h4>Anexos</h4>
      <ul className="lista-documentos">
        {anexos.map((anexo) => (
          <li key={anexo.chave}>
            <span>{anexo.nome}</span>
            <button type="button" className="btn-icone btn-icone-perigo" onClick={() => handleRemover(anexo)} title="Remover anexo" aria-label={`Remover anexo ${anexo.nome}`}>
              <IconeSupabase arquivo="trash3.svg" />
            </button>
          </li>
        ))}
        {anexos.length === 0 && <li className="hierarquia-vazio">Nenhum anexo ainda.</li>}
      </ul>
      <div className="upload-form">
        <input type="text" placeholder="Nome do arquivo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} accept="application/pdf,image/*" />
        <button type="button" onClick={enviar} disabled={!arquivo || !nome.trim() || enviando}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </div>
    </div>
  );
}

function ItemDocumentoLinha({
  documento,
  tituloExibido,
  renomeacaoPendente,
  modoEdicao,
  pendente,
  editando,
  rascunho,
  onAbrirEdicao,
  onExpandir,
  expandido,
  onIniciarRenomear,
  onRascunhoChange,
  onConfirmarEdicao,
  onCancelarEdicao,
  onMarcarExclusao,
  onDesfazerExclusao,
}: {
  documento: Documento;
  tituloExibido: string;
  renomeacaoPendente: boolean;
  modoEdicao: boolean;
  pendente: boolean;
  editando: boolean;
  rascunho: string;
  onAbrirEdicao: () => void;
  onExpandir: () => void;
  expandido: boolean;
  onIniciarRenomear: () => void;
  onRascunhoChange: (v: string) => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
  onMarcarExclusao: () => void;
  onDesfazerExclusao: () => void;
}) {
  const sortable = useSortable({ id: documento.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmarEdicao();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelarEdicao();
    }
  }

  if (editando) {
    return (
      <div ref={sortable.setNodeRef} style={style} className="documentos-item documentos-item-editando">
        <input value={rascunho} onChange={(e) => onRascunhoChange(e.target.value)} onKeyDown={handleKeyDown} autoFocus aria-label={`Renomear ${tituloExibido}`} />
        <button type="button" className="btn-icone" onClick={onConfirmarEdicao} title="Confirmar" aria-label="Confirmar">
          ✓
        </button>
        <button type="button" className="btn-icone" onClick={onCancelarEdicao} title="Cancelar" aria-label="Cancelar">
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={sortable.setNodeRef} style={style} className={`documentos-item${pendente ? ' documentos-item-pendente' : ''}${renomeacaoPendente ? ' documentos-item-renomeado' : ''}`}>
      {modoEdicao && !pendente && (
        <button type="button" className="btn-icone documentos-arrastar" aria-label={`Arrastar ${tituloExibido}`} {...sortable.attributes} {...sortable.listeners}>
          <IconeSupabase arquivo="broomstick.svg" />
        </button>
      )}
      <button type="button" className="documentos-titulo-botao" onClick={() => (modoEdicao ? undefined : onExpandir())} disabled={pendente || modoEdicao}>
        <span className="documentos-seta">{expandido ? '▾' : '▸'}</span>
        {tituloExibido}
      </button>
      {modoEdicao && !pendente && (
        <button type="button" className="btn-icone" onClick={onIniciarRenomear} title="Renomear" aria-label={`Renomear ${tituloExibido}`}>
          <IconeSupabase arquivo="save.svg" />
        </button>
      )}
      {!modoEdicao && (
        <button type="button" onClick={onAbrirEdicao} disabled={pendente}>
          Editar
        </button>
      )}
      {modoEdicao &&
        (pendente ? (
          <button type="button" className="documentos-btn-desfazer" onClick={onDesfazerExclusao} title={`Desfazer exclusão de ${tituloExibido}`}>
            Desfazer
          </button>
        ) : (
          <button type="button" className="btn-icone btn-icone-perigo" onClick={onMarcarExclusao} title={`Excluir ${tituloExibido}`} aria-label={`Excluir ${tituloExibido}`}>
            <IconeSupabase arquivo="trash3.svg" />
          </button>
        ))}
    </div>
  );
}

function ItemDocumentoExpandido({ documento }: { documento: Documento }) {
  const { data: campos, isLoading: carregandoCampos } = useDocumentoCampos(documento.id);
  const { data: anexos, isLoading: carregandoAnexos } = useDocumentoAnexos(documento.id);
  if (carregandoCampos || carregandoAnexos) return <p>Carregando…</p>;
  return (
    <div className="documentos-item-expandido">
      <ExibicaoCampos campos={campos ?? []} />
      <ExibicaoAnexos anexos={anexos ?? []} />
    </div>
  );
}

export function DocumentosAreaPage({ area }: { area: AreaDocumento }) {
  const { data: documentos, isLoading } = useDocumentos(area);
  const criarCompleto = useCriarDocumentoCompleto(area);
  const renomear = useRenomearDocumento(area);
  const excluir = useExcluirDocumento(area);
  const reordenar = useReordenarDocumentos(area);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [busca, setBusca] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunhoNome, setRascunhoNome] = useState('');
  const [ordemLocal, setOrdemLocal] = useState<Documento[] | null>(null);
  const [exclusoesPendentes, setExclusoesPendentes] = useState<Set<string>>(new Set());
  const [renomeacoesPendentes, setRenomeacoesPendentes] = useState<Map<string, string>>(new Map());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [documentoEditando, setDocumentoEditando] = useState<Documento | null>(null);
  const [novoId, setNovoId] = useState<string>('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novosCampos, setNovosCampos] = useState<LinhaCampo[]>([]);
  const [novosAnexos, setNovosAnexos] = useState<AnexoPendente[]>([]);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [camposEdicao, setCamposEdicao] = useState<LinhaCampo[]>([]);
  const [salvandoModal, setSalvandoModal] = useState(false);

  const { data: camposDocumentoEditando } = useDocumentoCampos(documentoEditando?.id ?? '');
  const salvarCamposEdicao = useSalvarCamposDocumento(documentoEditando?.id ?? '');
  const campoSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!documentoEditando) {
      campoSeedRef.current = null;
      return;
    }
    if (campoSeedRef.current === documentoEditando.id) return;
    if (camposDocumentoEditando === undefined) return;
    campoSeedRef.current = documentoEditando.id;
    setCamposEdicao(camposDocumentoEditando.map((c) => ({ chave: c.id, nome: c.nome, conteudo: c.conteudo ?? '', copiavel: c.copiavel })));
  }, [documentoEditando, camposDocumentoEditando]);

  const haAlteracoesOrdem = ordemLocal !== null;
  const temPendencias = haAlteracoesOrdem || exclusoesPendentes.size > 0 || renomeacoesPendentes.size > 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dados = ordemLocal ?? documentos ?? [];
  const q = busca.trim().toLowerCase();
  const filtrados = !q ? dados : dados.filter((d) => d.titulo.toLowerCase().includes(q));

  function tituloAtual(d: Documento): string {
    return renomeacoesPendentes.get(d.id) ?? d.titulo;
  }

  function alternarExpandir(id: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function marcarExclusao(d: Documento) {
    setExclusoesPendentes((atual) => new Set(atual).add(d.id));
  }
  function desfazerExclusao(d: Documento) {
    setExclusoesPendentes((atual) => {
      const novo = new Set(atual);
      novo.delete(d.id);
      return novo;
    });
  }
  function iniciarEdicaoNome(d: Documento) {
    setEdicaoAtivaId(d.id);
    setRascunhoNome(tituloAtual(d));
  }
  function cancelarEdicaoNome() {
    setEdicaoAtivaId(null);
    setRascunhoNome('');
  }
  function confirmarEdicaoNome(d: Documento) {
    const novo = rascunhoNome.trim();
    cancelarEdicaoNome();
    if (!novo || novo === tituloAtual(d)) return;
    setRenomeacoesPendentes((atual) => {
      const novoMapa = new Map(atual);
      if (novo === d.titulo) novoMapa.delete(d.id);
      else novoMapa.set(d.id, novo);
      return novoMapa;
    });
  }

  function entrarModoEdicao() {
    setModoEdicao(true);
  }
  function sairModoEdicao() {
    setModoEdicao(false);
    setOrdemLocal(null);
    setExclusoesPendentes(new Set());
    setRenomeacoesPendentes(new Map());
    cancelarEdicaoNome();
  }

  async function salvarAlteracoesLista() {
    if (!temPendencias) return;
    if (exclusoesPendentes.size > 0) {
      const ok = await confirmar({
        titulo: `Excluir ${exclusoesPendentes.size} documento(s)?`,
        mensagem: 'Os campos e anexos desses documentos também serão excluídos. Essa ação não pode ser desfeita.',
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      if (ordemLocal) {
        await reordenar.mutateAsync(ordemLocal.map((d, i) => ({ id: d.id, ordem: i + 1 })));
      }
      for (const [id, titulo] of renomeacoesPendentes) {
        if (exclusoesPendentes.has(id)) continue;
        await renomear.mutateAsync({ id, titulo });
      }
      for (const id of exclusoesPendentes) {
        await excluir.mutateAsync(id);
      }
      mostrarToast('Alterações salvas.');
      sairModoEdicao();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const base = ordemLocal ?? documentos ?? [];
    const oldIndex = base.findIndex((d) => d.id === active.id);
    const newIndex = base.findIndex((d) => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setBusca('');
    setOrdemLocal(arrayMove(base, oldIndex, newIndex));
  }

  function abrirNovo() {
    setDocumentoEditando(null);
    setNovoId(crypto.randomUUID());
    setNovoTitulo('');
    setNovosCampos([]);
    setNovosAnexos([]);
    setModalAberto(true);
  }

  function abrirEdicao(d: Documento) {
    campoSeedRef.current = null;
    setDocumentoEditando(d);
    setTituloEdicao(d.titulo);
    setCamposEdicao([]);
    setModalAberto(true);
  }

  function fecharEdicao() {
    setModalAberto(false);
    setDocumentoEditando(null);
  }

  async function fecharModal() {
    if (!documentoEditando && (novoTitulo.trim() || novosCampos.some((c) => c.nome.trim() || c.conteudo.trim()) || novosAnexos.length > 0)) {
      const ok = await confirmar({ titulo: 'Descartar este documento?', mensagem: 'O que você preencheu não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
      for (const anexo of novosAnexos) {
        try {
          await removerArquivo(BUCKET_CONFIDENCIAL, anexo.caminho);
        } catch {
          /* melhor esforço: se falhar em apagar do storage, não trava o fechamento do modal */
        }
      }
    }
    setModalAberto(false);
    setDocumentoEditando(null);
  }

  async function salvarNovo() {
    if (!novoTitulo.trim()) {
      mostrarToast('Dê um título ao documento.', 'erro');
      return;
    }
    const camposInvalidos = novosCampos.some((c) => c.conteudo.trim() && !c.nome.trim());
    if (camposInvalidos) {
      mostrarToast('Dê um nome ao campo antes de salvar.', 'erro');
      return;
    }
    setSalvandoModal(true);
    try {
      const camposValidos = novosCampos.filter((c) => c.nome.trim());
      const campos: DadosCampoDocumento[] = camposValidos.map((c) => ({ nome: c.nome.trim(), conteudo: c.conteudo.trim() || null, copiavel: c.copiavel }));
      const anexos: AnexoParaSalvar[] = novosAnexos.map((a) => ({ nome: a.nome, arquivo_url: a.caminho, nome_arquivo: a.nomeArquivo }));
      await criarCompleto.mutateAsync({ id: novoId, titulo: novoTitulo.trim(), camposLivres: campos, anexos });
      mostrarToast('Documento salvo.');
      setModalAberto(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvandoModal(false);
    }
  }

  async function salvarEdicao() {
    if (!documentoEditando) return;
    if (!tituloEdicao.trim()) {
      mostrarToast('Dê um título ao documento.', 'erro');
      return;
    }
    const camposInvalidos = camposEdicao.some((c) => c.conteudo.trim() && !c.nome.trim());
    if (camposInvalidos) {
      mostrarToast('Dê um nome ao campo antes de salvar.', 'erro');
      return;
    }
    setSalvandoModal(true);
    try {
      if (tituloEdicao.trim() !== documentoEditando.titulo) {
        await renomear.mutateAsync({ id: documentoEditando.id, titulo: tituloEdicao.trim() });
      }
      const campos: DadosCampoDocumento[] = camposEdicao
        .filter((c) => c.nome.trim())
        .map((c) => ({ nome: c.nome.trim(), conteudo: c.conteudo.trim() || null, copiavel: c.copiavel }));
      await salvarCamposEdicao.mutateAsync(campos);
      mostrarToast('Documento salvo.');
      setModalAberto(false);
      setDocumentoEditando(null);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvandoModal(false);
    }
  }

  return (
    <div className="documentos-lista-pagina">
      <div className="documentos-busca-linha">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar em ${AREA_LABEL[area]}…`}
          aria-label={`Buscar em ${AREA_LABEL[area]}`}
          disabled={haAlteracoesOrdem}
        />
        <button type="button" onClick={abrirNovo} disabled={modoEdicao}>
          + Documento
        </button>
        <button
          type="button"
          className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
          onClick={() => (modoEdicao ? sairModoEdicao() : entrarModoEdicao())}
          title={modoEdicao ? 'Sair do modo de edição' : 'Editar (arrastar/excluir)'}
          aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição'}
        >
          <IconeSupabase arquivo="broomstick.svg" />
        </button>
        <button
          type="button"
          className="btn-icone"
          onClick={salvarAlteracoesLista}
          disabled={!modoEdicao || !temPendencias || salvando}
          title="Salvar alterações"
          aria-label="Salvar alterações"
        >
          <IconeSupabase arquivo="save.svg" />
        </button>
      </div>

      {isLoading ? (
        <p>Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="documentos-vazio">{q ? 'Nenhum resultado.' : `Nenhum documento em ${AREA_LABEL[area]} ainda.`}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filtrados.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="documentos-lista-area">
              {filtrados.map((d) => {
                const pendente = exclusoesPendentes.has(d.id);
                const expandido = q ? true : expandidos.has(d.id);
                return (
                  <div key={d.id}>
                    <ItemDocumentoLinha
                      documento={d}
                      tituloExibido={tituloAtual(d)}
                      renomeacaoPendente={renomeacoesPendentes.has(d.id)}
                      modoEdicao={modoEdicao}
                      pendente={pendente}
                      editando={edicaoAtivaId === d.id}
                      rascunho={rascunhoNome}
                      onAbrirEdicao={() => abrirEdicao(d)}
                      onExpandir={() => alternarExpandir(d.id)}
                      expandido={expandido}
                      onIniciarRenomear={() => iniciarEdicaoNome(d)}
                      onRascunhoChange={setRascunhoNome}
                      onConfirmarEdicao={() => confirmarEdicaoNome(d)}
                      onCancelarEdicao={cancelarEdicaoNome}
                      onMarcarExclusao={() => marcarExclusao(d)}
                      onDesfazerExclusao={() => desfazerExclusao(d)}
                    />
                    {expandido && !modoEdicao && <ItemDocumentoExpandido documento={d} />}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ModalBase aberto={modalAberto} rotulo={documentoEditando ? documentoEditando.titulo : 'Novo documento'} onFechar={documentoEditando ? fecharEdicao : fecharModal} classe="modal-edicao">
        <h3 className="modal-titulo">{documentoEditando ? 'Editar documento' : 'Novo documento'}</h3>
        {documentoEditando ? (
          <>
            <label>
              Título
              <input type="text" value={tituloEdicao} onChange={(e) => setTituloEdicao(e.target.value)} data-autofocus />
            </label>
            <EditorCampos campos={camposEdicao} onChange={setCamposEdicao} />
            <div className="modal-acoes">
              <button type="button" onClick={salvarEdicao} disabled={!tituloEdicao.trim() || salvandoModal}>
                {salvandoModal ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" onClick={fecharEdicao}>
                Cancelar
              </button>
            </div>
            <SecaoAnexosDocumento documentoId={documentoEditando.id} />
          </>
        ) : (
          <>
            <label>
              Título
              <input type="text" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} data-autofocus />
            </label>
            <EditorCampos campos={novosCampos} onChange={setNovosCampos} />
            <SecaoAnexosPendentes documentoId={novoId} anexos={novosAnexos} onChange={setNovosAnexos} />
            <div className="modal-acoes">
              <button type="button" onClick={salvarNovo} disabled={!novoTitulo.trim() || salvandoModal}>
                {salvandoModal ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" onClick={fecharModal}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </ModalBase>
    </div>
  );
}
