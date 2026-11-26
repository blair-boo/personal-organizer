import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CriarCasalModal } from './CriarCasalModal';
import { BotaoSalvarModal, ModalBase } from '../../components/ModalBase';
import { ArquivoLink, BotaoBaixarArquivo } from '../../components/ArquivoLink';
import { IconeFuncao } from '../../components/IconeUso';
import { IconePng } from '../../components/IconeSupabase';
import { IconePessoa } from '../../components/IconePessoa';
import { ModalIcone } from '../../components/ModalIcone';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { resolverUso } from '../../lib/iconesUsos';
import { useIconesUsos, useRemoverUsoIcone, useSalvarUsoIcone } from '../../hooks/useIconesUsos';
import { useTemaEfetivo } from '../../hooks/useTema';
import { copiarConteudo } from '../../lib/clipboard';
import { formatarData, somarPeriodo } from '../../lib/datas';
import { caminhoAnexoDocumento, enviarArquivo, removerArquivo } from '../../lib/storage';
import {
  BUCKET_CONFIDENCIAL,
  useAdicionarAnexoDocumento,
  useAtualizarDocumentoPessoal,
  useCriarDocumentoCompleto,
  useCriarPessoaDocumentos,
  useDocumentoAnexos,
  useDocumentoLocaisRenovacao,
  useDocumentos,
  useDocumentosPessoas,
  useExcluirDocumento,
  useExcluirPessoaDocumentos,
  useProximosVencimentosPessoais,
  useRemoverAnexoDocumento,
  useRenomearDocumento,
  useRenomearPessoaDocumentos,
  useReordenarDocumentos,
  useSalvarLocaisRenovacao,
  type DadosDocumentoPessoal,
  type DadosLocalRenovacao,
  type ProximoVencimento,
} from '../../hooks/useDocumentos';
import type {
  Documento,
  DocumentoAnexo,
  DocumentoLocalRenovacao,
  PessoaDocumentos,
  RenovarTipo,
  UsoIcone,
  VencimentoTipo,
  VencimentoUnidade,
} from '../../types';

const EXPIRACAO_URL_SEGUNDOS = 60;

const UNIDADE_LABEL: Record<VencimentoUnidade, string> = { dias: 'dia(s)', meses: 'mês(es)', anos: 'ano(s)' };

function ehCNH(titulo: string): boolean {
  return titulo.toUpperCase().includes('CNH');
}

function avisoRelevante(tipo: VencimentoTipo | ''): boolean {
  return tipo === 'data' || tipo === 'prazo';
}

interface FormPessoalState {
  numero: string;
  numeroEspelho: string;
  emissao: string;
  vencimentoTipo: VencimentoTipo | '';
  vencimentoData: string;
  vencimentoQuantidade: string;
  vencimentoUnidade: VencimentoUnidade | '';
  avisoVencimento: boolean;
  avisoDias: string;
  renovarTipo: RenovarTipo | '';
  renovarSiteNome: string;
  renovarSiteLink: string;
}

function estadoVazio(): FormPessoalState {
  return {
    numero: '',
    numeroEspelho: '',
    emissao: '',
    vencimentoTipo: '',
    vencimentoData: '',
    vencimentoQuantidade: '',
    vencimentoUnidade: '',
    avisoVencimento: false,
    avisoDias: '',
    renovarTipo: '',
    renovarSiteNome: '',
    renovarSiteLink: '',
  };
}

function estadoDeDocumento(d: Documento): FormPessoalState {
  return {
    numero: d.numero ?? '',
    numeroEspelho: d.numero_espelho ?? '',
    emissao: d.emissao ?? '',
    vencimentoTipo: d.vencimento_tipo ?? '',
    vencimentoData: d.vencimento_data ?? '',
    vencimentoQuantidade: d.vencimento_quantidade != null ? String(d.vencimento_quantidade) : '',
    vencimentoUnidade: d.vencimento_unidade ?? '',
    avisoVencimento: d.aviso_vencimento,
    avisoDias: d.aviso_dias != null ? String(d.aviso_dias) : '',
    renovarTipo: d.renovar_tipo ?? '',
    renovarSiteNome: d.renovar_site_nome ?? '',
    renovarSiteLink: d.renovar_site_link ?? '',
  };
}

function calcularVencimentoCalculada(estado: FormPessoalState): string | null {
  if (estado.vencimentoTipo === 'data') return estado.vencimentoData || null;
  if (estado.vencimentoTipo === 'prazo' && estado.emissao && estado.vencimentoQuantidade && estado.vencimentoUnidade) {
    return somarPeriodo(estado.emissao, Number(estado.vencimentoQuantidade), estado.vencimentoUnidade);
  }
  return null;
}

function montarCamposFixos(estado: FormPessoalState, isCNH: boolean): Omit<DadosDocumentoPessoal, 'titulo'> {
  const vencimentoTipo = estado.vencimentoTipo || null;
  const renovarAplicavel = avisoRelevante(estado.vencimentoTipo);
  const renovarOnline = renovarAplicavel && (estado.renovarTipo === 'online' || estado.renovarTipo === 'ambos');
  return {
    numero: estado.numero.trim() || null,
    numero_espelho: isCNH ? estado.numeroEspelho.trim() || null : null,
    emissao: estado.emissao || null,
    vencimento_tipo: vencimentoTipo,
    vencimento_data: vencimentoTipo === 'data' ? estado.vencimentoData || null : null,
    vencimento_quantidade: vencimentoTipo === 'prazo' && estado.vencimentoQuantidade ? Number(estado.vencimentoQuantidade) : null,
    vencimento_unidade: vencimentoTipo === 'prazo' ? estado.vencimentoUnidade || null : null,
    vencimento_calculada: calcularVencimentoCalculada(estado),
    aviso_vencimento: renovarAplicavel ? estado.avisoVencimento : false,
    aviso_dias: renovarAplicavel && estado.avisoVencimento && estado.avisoDias ? Number(estado.avisoDias) : null,
    renovar_tipo: renovarAplicavel ? estado.renovarTipo || null : null,
    renovar_site_nome: renovarOnline ? estado.renovarSiteNome.trim() || null : null,
    renovar_site_link: renovarOnline ? estado.renovarSiteLink.trim() || null : null,
  };
}

interface LinhaLocal {
  chave: string;
  local: string;
  endereco: string;
  telefone: string;
}

function novaLinhaLocal(): LinhaLocal {
  return { chave: crypto.randomUUID(), local: '', endereco: '', telefone: '' };
}

function locaisDeServidor(locais: DocumentoLocalRenovacao[]): LinhaLocal[] {
  return locais.map((l) => ({ chave: l.id, local: l.local ?? '', endereco: l.endereco ?? '', telefone: l.telefone ?? '' }));
}

function EditorLocais({ locais, onChange }: { locais: LinhaLocal[]; onChange: (locais: LinhaLocal[]) => void }) {
  function atualizar(chave: string, patch: Partial<LinhaLocal>) {
    onChange(locais.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }
  function remover(chave: string) {
    onChange(locais.filter((l) => l.chave !== chave));
  }
  return (
    <div className="documentos-locais-editor">
      {locais.map((l) => (
        <div key={l.chave} className="documentos-local-linha">
          <input type="text" placeholder="Local" value={l.local} onChange={(e) => atualizar(l.chave, { local: e.target.value })} />
          <input type="text" placeholder="Endereço" value={l.endereco} onChange={(e) => atualizar(l.chave, { endereco: e.target.value })} />
          <input type="text" placeholder="Telefone" value={l.telefone} onChange={(e) => atualizar(l.chave, { telefone: e.target.value })} />
          <button type="button" className="btn-icone btn-icone-perigo" onClick={() => remover(l.chave)} title="Remover local" aria-label="Remover local de renovação">
            <IconeFuncao funcao="excluir" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...locais, novaLinhaLocal()])}>
        + Local
      </button>
    </div>
  );
}

/** Formulário fixo dos documentos pessoais (Número, Emissão, Vencimento, Aviso, Renovar). */
function FormularioCamposFixos({
  estado,
  onChange,
  isCNH,
  locais,
  onLocaisChange,
}: {
  estado: FormPessoalState;
  onChange: (estado: FormPessoalState) => void;
  isCNH: boolean;
  locais: LinhaLocal[];
  onLocaisChange: (locais: LinhaLocal[]) => void;
}) {
  const mostraAviso = avisoRelevante(estado.vencimentoTipo);
  const mostraRenovar = avisoRelevante(estado.vencimentoTipo);
  const mostraOnline = estado.renovarTipo === 'online' || estado.renovarTipo === 'ambos';
  const mostraPresencial = estado.renovarTipo === 'presencial' || estado.renovarTipo === 'ambos';

  return (
    <div className="documentos-form-fixo">
      <label>
        Número
        <input type="text" value={estado.numero} onChange={(e) => onChange({ ...estado, numero: e.target.value })} />
      </label>
      {isCNH && (
        <label>
          Número do espelho
          <input type="text" value={estado.numeroEspelho} onChange={(e) => onChange({ ...estado, numeroEspelho: e.target.value })} />
        </label>
      )}
      <label>
        Emissão
        <input type="date" value={estado.emissao} onChange={(e) => onChange({ ...estado, emissao: e.target.value })} />
      </label>
      <label>
        Vencimento
        <select
          value={estado.vencimentoTipo}
          onChange={(e) => onChange({ ...estado, vencimentoTipo: e.target.value as VencimentoTipo })}
        >
          <option value="">Selecione…</option>
          <option value="data">Data</option>
          <option value="prazo">D/M/A</option>
          <option value="indeterminado">Indeterminado</option>
        </select>
      </label>
      {estado.vencimentoTipo === 'data' && (
        <label>
          Data de vencimento
          <input type="date" value={estado.vencimentoData} onChange={(e) => onChange({ ...estado, vencimentoData: e.target.value })} />
        </label>
      )}
      {estado.vencimentoTipo === 'prazo' && (
        <div className="documentos-prazo-linha">
          <input
            type="number"
            min={1}
            placeholder="Quantidade"
            value={estado.vencimentoQuantidade}
            onChange={(e) => onChange({ ...estado, vencimentoQuantidade: e.target.value })}
          />
          <select value={estado.vencimentoUnidade} onChange={(e) => onChange({ ...estado, vencimentoUnidade: e.target.value as VencimentoUnidade })}>
            <option value="">Unidade…</option>
            <option value="dias">Dias</option>
            <option value="meses">Mês/meses</option>
            <option value="anos">Ano/anos</option>
          </select>
        </div>
      )}

      {mostraAviso && (
        <>
          <label className="documentos-checkbox-linha">
            <input type="checkbox" checked={estado.avisoVencimento} onChange={(e) => onChange({ ...estado, avisoVencimento: e.target.checked })} />
            Avisar antes do vencimento
          </label>
          {estado.avisoVencimento && (
            <label>
              Dias antes do vencimento
              <input type="number" min={1} value={estado.avisoDias} onChange={(e) => onChange({ ...estado, avisoDias: e.target.value })} />
            </label>
          )}
        </>
      )}

      {mostraRenovar && (
        <>
          <label>
            Renovar
            <select value={estado.renovarTipo} onChange={(e) => onChange({ ...estado, renovarTipo: e.target.value as RenovarTipo })}>
              <option value="">Selecione…</option>
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
              <option value="ambos">Ambos</option>
            </select>
          </label>
          {mostraOnline && (
            <>
              <label>
                Nome do site
                <input type="text" value={estado.renovarSiteNome} onChange={(e) => onChange({ ...estado, renovarSiteNome: e.target.value })} />
              </label>
              <label>
                Link
                <input type="url" value={estado.renovarSiteLink} onChange={(e) => onChange({ ...estado, renovarSiteLink: e.target.value })} />
              </label>
            </>
          )}
          {mostraPresencial && <EditorLocais locais={locais} onChange={onLocaisChange} />}
        </>
      )}
    </div>
  );
}

function LinhaExibicao({ rotulo, valor, onEditar }: { rotulo: string; valor: string; onEditar?: () => void }) {
  const { mostrarToast } = useToast();
  const texto = (
    <>
      <strong>{rotulo}:</strong> {valor}
    </>
  );
  return (
    <div className="documentos-campo-exibicao-linha">
      {onEditar ? (
        <button type="button" className="documentos-campo-editavel" onClick={onEditar} title={`Editar ${rotulo}`} aria-label={`Editar ${rotulo}: ${valor}`}>
          {texto}
        </button>
      ) : (
        <span>{texto}</span>
      )}
      <button type="button" className="btn-icone" onClick={() => copiarConteudo(valor, mostrarToast, rotulo)} title={`Copiar ${rotulo}`} aria-label={`Copiar ${rotulo}`}>
        <IconeFuncao funcao="salvar" />
      </button>
    </div>
  );
}

function textoVencimento(d: Documento): string | null {
  if (d.vencimento_tipo === 'data' && d.vencimento_data) return formatarData(d.vencimento_data);
  if (d.vencimento_tipo === 'prazo' && d.vencimento_quantidade && d.vencimento_unidade) {
    const base = `${d.vencimento_quantidade} ${UNIDADE_LABEL[d.vencimento_unidade]}`;
    return d.vencimento_calculada ? `${base} (vence em ${formatarData(d.vencimento_calculada)})` : base;
  }
  if (d.vencimento_tipo === 'indeterminado') return 'Indeterminado';
  return null;
}

function ExibicaoDocumentoPessoal({ documento, onEditar }: { documento: Documento; onEditar?: () => void }) {
  const { data: anexos, isLoading: carregandoAnexos } = useDocumentoAnexos(documento.id);
  const { data: locais, isLoading: carregandoLocais } = useDocumentoLocaisRenovacao(documento.id);
  const vencimentoTexto = textoVencimento(documento);
  const isCNH = ehCNH(documento.titulo);

  const semNadaPreenchido = !documento.numero && !documento.numero_espelho && !documento.emissao && !vencimentoTexto;

  if (carregandoAnexos || carregandoLocais) return <p>Carregando…</p>;

  return (
    <div className="documentos-item-expandido">
      {semNadaPreenchido ? (
        onEditar ? (
          <button type="button" className="documentos-campo-editavel hierarquia-vazio" onClick={onEditar}>
            Nenhuma informação preenchida ainda. Toque para preencher.
          </button>
        ) : (
          <p className="hierarquia-vazio">Nenhuma informação preenchida ainda.</p>
        )
      ) : (
        <div className="documentos-campos-exibicao">
          {documento.numero && <LinhaExibicao onEditar={onEditar} rotulo="Número" valor={documento.numero} />}
          {isCNH && documento.numero_espelho && <LinhaExibicao onEditar={onEditar} rotulo="Número do espelho" valor={documento.numero_espelho} />}
          {documento.emissao && <LinhaExibicao onEditar={onEditar} rotulo="Emissão" valor={formatarData(documento.emissao)} />}
          {vencimentoTexto && <LinhaExibicao onEditar={onEditar} rotulo="Vencimento" valor={vencimentoTexto} />}
          {(documento.vencimento_tipo === 'data' || documento.vencimento_tipo === 'prazo') && (
            <LinhaExibicao onEditar={onEditar} rotulo="Aviso de vencimento" valor={documento.aviso_vencimento ? `Sim, ${documento.aviso_dias ?? '?'} dia(s) antes` : 'Não'} />
          )}
          {documento.renovar_tipo && (documento.renovar_tipo === 'online' || documento.renovar_tipo === 'ambos') && documento.renovar_site_nome && (
            <LinhaExibicao onEditar={onEditar} rotulo="Site para renovar" valor={documento.renovar_site_nome} />
          )}
          {documento.renovar_tipo && (documento.renovar_tipo === 'online' || documento.renovar_tipo === 'ambos') && documento.renovar_site_link && (
            <LinhaExibicao onEditar={onEditar} rotulo="Link para renovar" valor={documento.renovar_site_link} />
          )}
          {(locais ?? []).map((l) => (
            <div key={l.id} className="documentos-local-exibicao">
              {l.local && <LinhaExibicao onEditar={onEditar} rotulo="Local" valor={l.local} />}
              {l.endereco && <LinhaExibicao onEditar={onEditar} rotulo="Endereço" valor={l.endereco} />}
              {l.telefone && <LinhaExibicao onEditar={onEditar} rotulo="Telefone" valor={l.telefone} />}
            </div>
          ))}
        </div>
      )}
      <div className="documentos-secao">
        <h4>Arquivos:</h4>
        <ul className="lista-documentos">
          {(anexos ?? []).map((anexo) => (
            <li key={anexo.id}>
              <span>{anexo.nome}</span>
              <span className="documentos-anexo-acoes">
                <ArquivoLink bucket={BUCKET_CONFIDENCIAL} caminho={anexo.arquivo_url} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}>
                  Visualizar
                </ArquivoLink>
                <BotaoBaixarArquivo bucket={BUCKET_CONFIDENCIAL} caminho={anexo.arquivo_url} nomeArquivo={anexo.nome_arquivo} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS} />
              </span>
            </li>
          ))}
          {anexos?.length === 0 && <li className="hierarquia-vazio">Nenhum anexo ainda.</li>}
        </ul>
      </div>
    </div>
  );
}

function SecaoAnexosDocumentoPessoal({ documentoId }: { documentoId: string }) {
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
                <BotaoBaixarArquivo bucket={BUCKET_CONFIDENCIAL} caminho={anexo.arquivo_url} nomeArquivo={anexo.nome_arquivo} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS} />
                <button type="button" className="btn-icone btn-icone-perigo" onClick={() => handleRemover(anexo)} title="Remover anexo" aria-label={`Remover anexo ${anexo.nome}`}>
                  <IconeFuncao funcao="excluir" />
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

function ItemDocumentoLinha({
  documento,
  tituloExibido,
  renomeacaoPendente,
  incompleto,
  modoEdicao,
  pendente,
  editando,
  rascunho,
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
  incompleto: boolean;
  modoEdicao: boolean;
  pendente: boolean;
  editando: boolean;
  rascunho: string;
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
          <IconeFuncao funcao="editar" />
        </button>
      )}
      <button type="button" className="documentos-titulo-botao" onClick={onExpandir} disabled={pendente}>
        <span className="documentos-seta">{expandido ? '▾' : '▸'}</span>
        {incompleto && <IconePng arquivo="warnings/UI_Img_DataSnake_Enemy_Mark.png" tamanho={16} titulo="Ainda sem preenchimento" />}
        {tituloExibido}
      </button>
      {modoEdicao && !pendente && (
        <button type="button" className="btn-icone" onClick={onIniciarRenomear} title="Renomear" aria-label={`Renomear ${tituloExibido}`}>
          <IconeFuncao funcao="salvar" />
        </button>
      )}
      {modoEdicao &&
        (pendente ? (
          <button type="button" className="documentos-btn-desfazer" onClick={onDesfazerExclusao} title={`Desfazer exclusão de ${tituloExibido}`}>
            Desfazer
          </button>
        ) : (
          <button type="button" className="btn-icone btn-icone-perigo" onClick={onMarcarExclusao} title={`Excluir ${tituloExibido}`} aria-label={`Excluir ${tituloExibido}`}>
            <IconeFuncao funcao="excluir" />
          </button>
        ))}
    </div>
  );
}

interface EdicaoPessoasProps {
  /** Há renomeações ou exclusões de pessoas esperando o salvar. */
  pessoasPendentes: boolean;
  /** Pergunta antes de excluir pessoas; false cancela o salvamento inteiro. */
  confirmarPessoas: () => Promise<boolean>;
  aplicarPessoas: () => Promise<void>;
  descartarPessoas: () => void;
}

function ListaDocumentosPessoa({
  pessoaId,
  pessoaNome,
  modoEdicao,
  onModoEdicao,
  pessoasPendentes,
  confirmarPessoas,
  aplicarPessoas,
  descartarPessoas,
}: { pessoaId: string; pessoaNome: string; modoEdicao: boolean; onModoEdicao: (ativo: boolean) => void } & EdicaoPessoasProps) {
  const { data: usosIcones = [] } = useIconesUsos();
  const temaEfetivo = useTemaEfetivo();
  const salvarUso = useSalvarUsoIcone();
  const removerUso = useRemoverUsoIcone();
  const [escolhendoIcone, setEscolhendoIcone] = useState(false);
  const { data: documentos, isLoading } = useDocumentos('pessoais', pessoaId);
  const criarCompleto = useCriarDocumentoCompleto('pessoais', pessoaId);
  const atualizar = useAtualizarDocumentoPessoal('pessoais', pessoaId);
  const renomear = useRenomearDocumento('pessoais', pessoaId);
  const excluir = useExcluirDocumento('pessoais', pessoaId);
  const reordenar = useReordenarDocumentos('pessoais', pessoaId);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [busca, setBusca] = useState('');
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunhoNome, setRascunhoNome] = useState('');
  const [ordemLocal, setOrdemLocal] = useState<Documento[] | null>(null);
  const [exclusoesPendentes, setExclusoesPendentes] = useState<Set<string>>(new Set());
  const [renomeacoesPendentes, setRenomeacoesPendentes] = useState<Map<string, string>>(new Map());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [documentoEditando, setDocumentoEditando] = useState<Documento | null>(null);
  const [novoId, setNovoId] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [estadoForm, setEstadoForm] = useState<FormPessoalState>(estadoVazio());
  const [locaisForm, setLocaisForm] = useState<LinhaLocal[]>([]);
  const [novosAnexos, setNovosAnexos] = useState<{ chave: string; nome: string; caminho: string; nomeArquivo: string; arquivoLocal?: File }[]>([]);
  const [salvandoModal, setSalvandoModal] = useState(false);

  const salvarLocaisEdicao = useSalvarLocaisRenovacao(documentoEditando?.id ?? '');
  const { data: locaisServidor } = useDocumentoLocaisRenovacao(documentoEditando?.id ?? '');
  const locaisSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!documentoEditando) {
      locaisSeedRef.current = null;
      return;
    }
    if (locaisSeedRef.current === documentoEditando.id) return;
    if (locaisServidor === undefined) return;
    locaisSeedRef.current = documentoEditando.id;
    setLocaisForm(locaisDeServidor(locaisServidor));
  }, [documentoEditando, locaisServidor]);

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
    onModoEdicao(true);
  }
  /** Sai do modo de edição e descarta tudo o que estava pendente (documentos e pessoas). */
  function limparEdicao() {
    onModoEdicao(false);
    setOrdemLocal(null);
    setExclusoesPendentes(new Set());
    setRenomeacoesPendentes(new Map());
    cancelarEdicaoNome();
    descartarPessoas();
  }
  async function pedirSairModoEdicao() {
    if (temPendencias || pessoasPendentes) {
      const ok = await confirmar({ titulo: 'Descartar as alterações?', mensagem: 'O que você alterou não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
    }
    limparEdicao();
  }

  async function salvarAlteracoesLista() {
    if (!temPendencias && !pessoasPendentes) return;
    if (exclusoesPendentes.size > 0) {
      const ok = await confirmar({
        titulo: `Excluir ${exclusoesPendentes.size} documento(s)?`,
        mensagem: 'As informações e anexos desses documentos também serão excluídos. Essa ação não pode ser desfeita.',
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    if (!(await confirmarPessoas())) return;
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
      await aplicarPessoas();
      mostrarToast('Alterações salvas.');
      limparEdicao();
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
    setEstadoForm(estadoVazio());
    setLocaisForm([]);
    setNovosAnexos([]);
    setModalAberto(true);
  }

  function abrirEdicao(d: Documento) {
    locaisSeedRef.current = null;
    setDocumentoEditando(d);
    setEstadoForm(estadoDeDocumento(d));
    setLocaisForm([]);
    setModalAberto(true);
  }

  function fecharEdicao() {
    setModalAberto(false);
    setDocumentoEditando(null);
  }

  async function fecharModalNovo() {
    const algoPreenchido =
      novoTitulo.trim() || Object.values(estadoForm).some((v) => (typeof v === 'string' ? v.trim() : v)) || novosAnexos.length > 0;
    if (algoPreenchido) {
      const ok = await confirmar({ titulo: 'Descartar este documento?', mensagem: 'O que você preencheu não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
      for (const anexo of novosAnexos) {
        if (anexo.arquivoLocal) continue;
        try {
          await removerArquivo(BUCKET_CONFIDENCIAL, anexo.caminho);
        } catch {
          /* melhor esforço */
        }
      }
    }
    setModalAberto(false);
  }

  async function salvarNovo() {
    if (!novoTitulo.trim()) {
      mostrarToast('Dê um título ao documento.', 'erro');
      return;
    }
    setSalvandoModal(true);
    try {
      const isCNH = ehCNH(novoTitulo);
      const camposFixos = montarCamposFixos(estadoForm, isCNH);
      const locaisValidos: DadosLocalRenovacao[] = locaisForm
        .filter((l) => l.local.trim() || l.endereco.trim() || l.telefone.trim())
        .map((l) => ({ local: l.local.trim() || null, endereco: l.endereco.trim() || null, telefone: l.telefone.trim() || null }));
      const anexos = novosAnexos.map((a) => ({ nome: a.nome, arquivo_url: a.caminho, nome_arquivo: a.nomeArquivo, arquivoLocal: a.arquivoLocal }));
      await criarCompleto.mutateAsync({
        id: novoId,
        titulo: novoTitulo.trim(),
        camposFixos,
        locaisRenovacao: camposFixos.renovar_tipo !== 'online' ? locaisValidos : [],
        anexos,
      });
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
    setSalvandoModal(true);
    try {
      const isCNH = ehCNH(documentoEditando.titulo);
      const camposFixos = montarCamposFixos(estadoForm, isCNH);
      await atualizar.mutateAsync({ id: documentoEditando.id, dados: { titulo: documentoEditando.titulo, ...camposFixos } });
      if (camposFixos.renovar_tipo === 'presencial' || camposFixos.renovar_tipo === 'ambos') {
        const locaisValidos: DadosLocalRenovacao[] = locaisForm
          .filter((l) => l.local.trim() || l.endereco.trim() || l.telefone.trim())
          .map((l) => ({ local: l.local.trim() || null, endereco: l.endereco.trim() || null, telefone: l.telefone.trim() || null }));
        await salvarLocaisEdicao.mutateAsync(locaisValidos);
      } else if ((locaisServidor ?? []).length > 0) {
        await salvarLocaisEdicao.mutateAsync([]);
      }
      mostrarToast('Documento salvo.');
      setModalAberto(false);
      setDocumentoEditando(null);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvandoModal(false);
    }
  }

  async function aplicarIconePessoa(uso: UsoIcone) {
    try {
      await salvarUso.mutateAsync(uso);
      mostrarToast(`Ícone de ${pessoaNome} salvo.`);
      setEscolhendoIcone(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function removerIconePessoa() {
    const ok = await confirmar({
      titulo: 'Remover ícone?',
      mensagem: `O ícone sai de "${pessoaNome}". O arquivo continua disponível na lista de ícones.`,
      confirmarRotulo: 'Remover',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await removerUso.mutateAsync({ alvoTipo: 'pessoa', alvoId: pessoaId });
      mostrarToast(`Ícone de ${pessoaNome} removido.`);
      setEscolhendoIcone(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  const isCNHEditando = documentoEditando ? ehCNH(documentoEditando.titulo) : false;
  const isCNHNovo = ehCNH(novoTitulo);

  return (
    <div className="documentos-lista-pagina">
      <div className="documentos-busca-linha">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar em ${pessoaNome}…`}
          aria-label={`Buscar em ${pessoaNome}`}
          disabled={haAlteracoesOrdem}
        />
        <button type="button" onClick={abrirNovo} disabled={modoEdicao}>
          + Documento
        </button>
        <button
          type="button"
          className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
          onClick={() => (modoEdicao ? void pedirSairModoEdicao() : entrarModoEdicao())}
          title={modoEdicao ? 'Sair do modo de edição' : 'Editar (pessoas, ordem, nomes e dados dos documentos)'}
          aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição'}
        >
          <IconeFuncao funcao="editar" />
        </button>
        <button
          type="button"
          className="btn-icone"
          onClick={salvarAlteracoesLista}
          disabled={!modoEdicao || !(temPendencias || pessoasPendentes) || salvando}
          title="Salvar alterações"
          aria-label="Salvar alterações"
        >
          <IconeFuncao funcao="salvar" />
        </button>
      </div>

      <div className="documentos-icone-pessoa">
        <button
          type="button"
          className="btn-icone documentos-icone-pessoa-botao"
          onClick={() => setEscolhendoIcone(true)}
          title={`Escolher ícone de ${pessoaNome}`}
          aria-label={`Escolher ícone de ${pessoaNome}`}
        >
          <IconePessoa pessoa={{ id: pessoaId, nome: pessoaNome }} tamanho={24} />
        </button>
        <span className="conta-detalhe">Ícone de {pessoaNome}, usado onde há pouco espaço.</span>
      </div>
      {escolhendoIcone && (
        <ModalIcone
          aberto
          rotuloAlvo={pessoaNome}
          alvoTipo="pessoa"
          alvoId={pessoaId}
          inicial={resolverUso(usosIcones, 'pessoa', pessoaId, temaEfetivo)}
          tamanhoBase={18}
          permiteRemover
          onConfirmar={(uso: UsoIcone) => void aplicarIconePessoa(uso)}
          onRemover={() => void removerIconePessoa()}
          onFechar={() => setEscolhendoIcone(false)}
        />
      )}

      {isLoading ? (
        <p>Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="documentos-vazio">{q ? 'Nenhum resultado.' : `Nenhum documento em ${pessoaNome} ainda.`}</p>
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
                      incompleto={!d.numero && !d.numero_espelho && !d.emissao && !d.vencimento_tipo}
                      modoEdicao={modoEdicao}
                      pendente={pendente}
                      editando={edicaoAtivaId === d.id}
                      rascunho={rascunhoNome}
                      onExpandir={() => alternarExpandir(d.id)}
                      expandido={expandido}
                      onIniciarRenomear={() => iniciarEdicaoNome(d)}
                      onRascunhoChange={setRascunhoNome}
                      onConfirmarEdicao={() => confirmarEdicaoNome(d)}
                      onCancelarEdicao={cancelarEdicaoNome}
                      onMarcarExclusao={() => marcarExclusao(d)}
                      onDesfazerExclusao={() => desfazerExclusao(d)}
                    />
                    {expandido && <ExibicaoDocumentoPessoal documento={d} onEditar={modoEdicao && !pendente ? () => abrirEdicao(d) : undefined} />}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ModalBase aberto={modalAberto} rotulo={documentoEditando ? documentoEditando.titulo : 'Novo documento'} onFechar={documentoEditando ? fecharEdicao : fecharModalNovo} classe="modal-edicao" perguntarAoDescartar={!!documentoEditando} titulo={documentoEditando ? documentoEditando.titulo : 'Novo documento'} rodape={
        <>
          {documentoEditando ? (
            <BotaoSalvarModal onClick={() => void salvarEdicao()} salvando={salvandoModal} />
          ) : (
            <BotaoSalvarModal onClick={() => void salvarNovo()} disabled={!novoTitulo.trim()} salvando={salvandoModal} />
          )}
        </>
      }>
        {documentoEditando ? (
          <>
            <FormularioCamposFixos estado={estadoForm} onChange={setEstadoForm} isCNH={isCNHEditando} locais={locaisForm} onLocaisChange={setLocaisForm} />
            <SecaoAnexosDocumentoPessoal documentoId={documentoEditando.id} />
          </>
        ) : (
          <>
            <label>
              Título
              <input type="text" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} data-autofocus />
            </label>
            <FormularioCamposFixos estado={estadoForm} onChange={setEstadoForm} isCNH={isCNHNovo} locais={locaisForm} onLocaisChange={setLocaisForm} />
            <SecaoAnexosPendentesPessoal documentoId={novoId} anexos={novosAnexos} onChange={setNovosAnexos} />
          </>
        )}
      </ModalBase>
    </div>
  );
}

function SecaoAnexosPendentesPessoal({
  documentoId,
  anexos,
  onChange,
}: {
  documentoId: string;
  anexos: { chave: string; nome: string; caminho: string; nomeArquivo: string; arquivoLocal?: File }[];
  onChange: (anexos: { chave: string; nome: string; caminho: string; nomeArquivo: string; arquivoLocal?: File }[]) => void;
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
      const caminho = caminhoAnexoDocumento('documentos-pessoais', documentoId, nome.trim(), arquivo);
      const chave = crypto.randomUUID();
      if (navigator.onLine) {
        await enviarArquivo(BUCKET_CONFIDENCIAL, caminho, arquivo);
        onChange([...anexos, { chave, nome: nome.trim(), caminho, nomeArquivo: arquivo.name }]);
      } else {
        onChange([...anexos, { chave, nome: nome.trim(), caminho, nomeArquivo: arquivo.name, arquivoLocal: arquivo }]);
      }
      setArquivo(null);
      setNome('');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(anexo: { chave: string; nome: string; caminho: string; nomeArquivo: string; arquivoLocal?: File }) {
    const ok = await confirmar({ titulo: 'Remover anexo?', mensagem: anexo.nome, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    try {
      if (!anexo.arquivoLocal) await removerArquivo(BUCKET_CONFIDENCIAL, anexo.caminho);
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
              <IconeFuncao funcao="excluir" />
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

function textoPrazoVencimento(item: ProximoVencimento): string {
  if (item.diasRestantes < 0) return `venceu há ${Math.abs(item.diasRestantes)} dia(s)`;
  if (item.diasRestantes === 0) return 'vence hoje';
  return `vence em ${item.diasRestantes} dia(s) (${formatarData(item.vencimentoCalculada)})`;
}

function ResumoVencimentos({ onSelecionarPessoa }: { onSelecionarPessoa: (pessoaId: string) => void }) {
  const { data: itens } = useProximosVencimentosPessoais();
  if (!itens || itens.length === 0) return null;
  return (
    <div className="documentos-resumo-vencimentos">
      <h3>Vencendo em breve</h3>
      <ul>
        {itens.map((item) => (
          <li key={item.documentoId}>
            <button type="button" className="documentos-resumo-item" onClick={() => onSelecionarPessoa(item.pessoaId)}>
              <strong>{item.pessoaNome}</strong> — {item.titulo}: {textoPrazoVencimento(item)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AbasPessoas({
  pessoas,
  pessoaAtualId,
  modoEdicao,
  renomeacoes,
  exclusoes,
  onSelecionar,
  onCriar,
  onCriarCasal,
  onRenomear,
  onMarcarExclusao,
  onDesfazerExclusao,
}: {
  pessoas: PessoaDocumentos[];
  pessoaAtualId: string | null;
  modoEdicao: boolean;
  renomeacoes: Map<string, string>;
  exclusoes: Set<string>;
  onSelecionar: (id: string) => void;
  onCriar: () => void;
  onCriarCasal: () => void;
  onRenomear: (p: PessoaDocumentos, nome: string) => void;
  onMarcarExclusao: (p: PessoaDocumentos) => void;
  onDesfazerExclusao: (p: PessoaDocumentos) => void;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);

  function nomeExibido(p: PessoaDocumentos): string {
    return renomeacoes.get(p.id) ?? p.nome;
  }
  function iniciarRenomear(p: PessoaDocumentos) {
    setEditandoId(p.id);
    setRascunho(nomeExibido(p));
  }
  function cancelarRenomear() {
    setEditandoId(null);
    setRascunho('');
  }
  function confirmarRenomear(p: PessoaDocumentos) {
    const novo = rascunho.trim();
    cancelarRenomear();
    if (!novo || novo === nomeExibido(p)) return;
    onRenomear(p, novo);
  }
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, p: PessoaDocumentos) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmarRenomear(p);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelarRenomear();
    }
  }

  return (
    <nav className="app-nav documentos-abas-pessoa">
      {pessoas.map((p) =>
        modoEdicao ? (
          <span key={p.id} className={`documentos-pessoa-editando${exclusoes.has(p.id) ? ' documentos-item-pendente' : ''}${renomeacoes.has(p.id) ? ' documentos-item-renomeado' : ''}`}>
            {editandoId === p.id ? (
              <input
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, p)}
                autoFocus
                aria-label={`Renomear ${nomeExibido(p)}`}
              />
            ) : (
              <button type="button" onClick={() => iniciarRenomear(p)} disabled={exclusoes.has(p.id)} title={`Renomear ${nomeExibido(p)}`}>
                <IconePessoa pessoa={p} />
                {nomeExibido(p)}
              </button>
            )}
            {exclusoes.has(p.id) ? (
              <button type="button" className="documentos-btn-desfazer" onClick={() => onDesfazerExclusao(p)} title={`Desfazer exclusão de ${p.nome}`}>
                Desfazer
              </button>
            ) : (
              <button type="button" className="btn-icone btn-icone-perigo" onClick={() => onMarcarExclusao(p)} title={`Excluir ${nomeExibido(p)}`} aria-label={`Excluir ${nomeExibido(p)}`}>
                <IconeFuncao funcao="excluir" />
              </button>
            )}
          </span>
        ) : (
          <button key={p.id} type="button" className={`documentos-aba-pessoa${pessoaAtualId === p.id ? ' active' : ''}`} onClick={() => onSelecionar(p.id)}>
            <IconePessoa pessoa={p} />
            {p.nome}
          </button>
        )
      )}
      {modoEdicao && (
        <div className="documentos-mais">
          <button
            type="button"
            className="btn-icone"
            onClick={() => setMenuMaisAberto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuMaisAberto}
            title="Adicionar pessoa ou casal"
            aria-label="Adicionar pessoa ou casal"
          >
            <IconeFuncao funcao="adicionar" />
          </button>
          {menuMaisAberto && (
            <div className="documentos-mais-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuMaisAberto(false);
                  onCriar();
                }}
              >
                Pessoa
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuMaisAberto(false);
                  onCriarCasal();
                }}
              >
                Casal
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export function DocumentosPessoaisPage() {
  const { data: pessoas, isLoading } = useDocumentosPessoas();
  const criarPessoa = useCriarPessoaDocumentos();
  const renomearPessoa = useRenomearPessoaDocumentos();
  const excluirPessoa = useExcluirPessoaDocumentos();
  const { pedirTexto, confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [pessoaAtualId, setPessoaAtualId] = useState<string | null>(null);
  const [criandoCasal, setCriandoCasal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [renomeacoes, setRenomeacoes] = useState<Map<string, string>>(new Map());
  const [exclusoes, setExclusoes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pessoas || pessoas.length === 0) return;
    if (pessoaAtualId && pessoas.some((p) => p.id === pessoaAtualId)) return;
    setPessoaAtualId(pessoas[0].id);
  }, [pessoas, pessoaAtualId]);

  async function adicionarPessoa() {
    const nome = await pedirTexto({ titulo: 'Nova pessoa', mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      const { pessoa } = await criarPessoa.mutateAsync(nome.trim());
      setPessoaAtualId(pessoa.id);
      mostrarToast('Pessoa criada com os documentos padrão.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function renomearPendente(p: PessoaDocumentos, nome: string) {
    setRenomeacoes((atual) => {
      const novo = new Map(atual);
      if (nome === p.nome) novo.delete(p.id);
      else novo.set(p.id, nome);
      return novo;
    });
  }
  function marcarExclusaoPessoa(p: PessoaDocumentos) {
    setExclusoes((atual) => new Set(atual).add(p.id));
  }
  function desfazerExclusaoPessoa(p: PessoaDocumentos) {
    setExclusoes((atual) => {
      const novo = new Set(atual);
      novo.delete(p.id);
      return novo;
    });
  }
  async function confirmarPessoas(): Promise<boolean> {
    if (exclusoes.size === 0) return true;
    return confirmar({
      titulo: `Excluir ${exclusoes.size} pessoa(s)?`,
      mensagem: 'Isso apaga também todos os documentos e anexos dessas pessoas. Essa ação não pode ser desfeita.',
      confirmarRotulo: 'Excluir e salvar',
      perigoso: true,
    });
  }
  async function aplicarPessoas() {
    for (const [id, nome] of renomeacoes) {
      if (exclusoes.has(id)) continue;
      await renomearPessoa.mutateAsync({ id, nome });
    }
    for (const id of exclusoes) {
      await excluirPessoa.mutateAsync(id);
    }
  }
  function descartarPessoas() {
    setRenomeacoes(new Map());
    setExclusoes(new Set());
  }

  const pessoaAtual = pessoas?.find((p) => p.id === pessoaAtualId) ?? null;

  return (
    <div>
      <ResumoVencimentos onSelecionarPessoa={setPessoaAtualId} />
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <AbasPessoas
          pessoas={pessoas ?? []}
          pessoaAtualId={pessoaAtualId}
          modoEdicao={modoEdicao}
          renomeacoes={renomeacoes}
          exclusoes={exclusoes}
          onSelecionar={setPessoaAtualId}
          onCriar={adicionarPessoa}
          onCriarCasal={() => setCriandoCasal(true)}
          onRenomear={renomearPendente}
          onMarcarExclusao={marcarExclusaoPessoa}
          onDesfazerExclusao={desfazerExclusaoPessoa}
        />
      )}
      {pessoaAtual && (
        <ListaDocumentosPessoa
          key={pessoaAtual.id}
          pessoaId={pessoaAtual.id}
          pessoaNome={pessoaAtual.nome}
          modoEdicao={modoEdicao}
          onModoEdicao={setModoEdicao}
          pessoasPendentes={renomeacoes.size > 0 || exclusoes.size > 0}
          confirmarPessoas={confirmarPessoas}
          aplicarPessoas={aplicarPessoas}
          descartarPessoas={descartarPessoas}
        />
      )}
      {criandoCasal && (
        <CriarCasalModal
          pessoas={pessoas ?? []}
          onFechar={() => setCriandoCasal(false)}
          onCriado={(casal) => {
            setCriandoCasal(false);
            setPessoaAtualId(casal.id);
          }}
        />
      )}
    </div>
  );
}
