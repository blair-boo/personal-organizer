import { useState, type FormEvent, type ReactNode } from 'react';
import { BotaoSalvarModal, ModalBase } from '../../components/ModalBase';
import { IconeFuncao } from '../../components/IconeUso';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';

export interface CampoRegistro {
  chave: string;
  rotulo: string;
  tipo: 'data' | 'texto' | 'textoLongo' | 'kg';
  obrigatorio?: boolean;
}

/** Valores do formulário, todos em texto; cada seção converte para o que precisa. */
export type ValoresRegistro = Record<string, string>;

interface SecaoRegistrosProps<T extends { id: string }> {
  titulo: string;
  /** Registros do gato, do mais recente para o mais antigo. */
  registros: T[];
  campos: CampoRegistro[];
  /** Linha de exibição de um registro. */
  linha: (registro: T) => ReactNode;
  /** Valores do formulário ao editar um registro. */
  valoresDe: (registro: T) => ValoresRegistro;
  /** Grava (registro = null: novo). `arquivo` só vem quando a seção pede arquivo. */
  onSalvar: (valores: ValoresRegistro, registro: T | null, arquivo: File | null) => Promise<void>;
  onExcluir: (registro: T) => Promise<void>;
  /** A seção guarda um arquivo por registro (exames): obrigatório ao incluir, opcional ao editar. */
  pedeArquivo?: boolean;
  /** Nome curto do item para os rótulos ("vacina", "pesagem"). */
  item: string;
  textoVazio: string;
  /** Conteúdo extra no topo da seção (ex.: gráfico de peso). */
  topo?: ReactNode;
}

/** Seção de um gato com uma lista de registros (vacinas, vermífugo, consultas, exames, peso): incluir, trocar e excluir. Abre e fecha. */
export function SecaoRegistros<T extends { id: string }>({ titulo, registros, campos, linha, valoresDe, onSalvar, onExcluir, pedeArquivo = false, item, textoVazio, topo }: SecaoRegistrosProps<T>) {
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [formulario, setFormulario] = useState<{ registro: T | null } | null>(null);

  async function aoExcluir(registro: T) {
    const ok = await confirmar({ titulo: `Excluir ${item}?`, mensagem: 'Essa ação não pode ser desfeita.', confirmarRotulo: 'Excluir', perigoso: true });
    if (!ok) return;
    try {
      await onExcluir(registro);
      mostrarToast('Excluído.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <details className="gatos-secao">
      <summary>
        {titulo} <span className="storage-codigo">({registros.length})</span>
      </summary>
      {topo}
      <ul className="gatos-registros">
        {registros.map((registro) => (
          <li key={registro.id} className="gatos-registro">
            <div className="gatos-registro-texto">{linha(registro)}</div>
            <div className="hierarquia-item-acoes">
              <button type="button" onClick={() => setFormulario({ registro })}>
                Editar
              </button>
              <button type="button" className="btn-icone btn-icone-perigo" onClick={() => void aoExcluir(registro)} title={`Excluir ${item}`} aria-label={`Excluir ${item}`}>
                <IconeFuncao funcao="excluir" />
              </button>
            </div>
          </li>
        ))}
        {registros.length === 0 && <li className="hierarquia-vazio">{textoVazio}</li>}
      </ul>
      <button type="button" onClick={() => setFormulario({ registro: null })}>
        + {item}
      </button>
      {formulario && (
        <FormularioRegistro
          titulo={`${formulario.registro ? 'Editar' : 'Nova'} ${item}`}
          campos={campos}
          pedeArquivo={pedeArquivo}
          arquivoObrigatorio={pedeArquivo && formulario.registro === null}
          iniciais={formulario.registro ? valoresDe(formulario.registro) : {}}
          onSalvar={async (valores, arquivo) => {
            await onSalvar(valores, formulario.registro, arquivo);
            setFormulario(null);
          }}
          onFechar={() => setFormulario(null)}
        />
      )}
    </details>
  );
}

function FormularioRegistro({
  titulo,
  campos,
  pedeArquivo,
  arquivoObrigatorio,
  iniciais,
  onSalvar,
  onFechar,
}: {
  titulo: string;
  campos: CampoRegistro[];
  pedeArquivo: boolean;
  arquivoObrigatorio: boolean;
  iniciais: ValoresRegistro;
  onSalvar: (valores: ValoresRegistro, arquivo: File | null) => Promise<void>;
  onFechar: () => void;
}) {
  const { mostrarToast } = useToast();
  const [valores, setValores] = useState<ValoresRegistro>(iniciais);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const faltando = campos.some((c) => c.obrigatorio && !(valores[c.chave] ?? '').trim()) || (arquivoObrigatorio && !arquivo);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (faltando) return;
    setSalvando(true);
    try {
      await onSalvar(valores, arquivo);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase aberto rotulo={titulo} onFechar={onFechar} classe="modal-edicao" titulo={titulo} rodape={
        <>
          <BotaoSalvarModal form="form-modal" disabled={faltando} salvando={salvando} />
        </>
      }>
      <form id="form-modal" onSubmit={aoEnviar}>
        {campos.map((c, i) => (
          <label key={c.chave}>
            {c.rotulo}
            {c.tipo === 'textoLongo' ? (
              <textarea rows={3} value={valores[c.chave] ?? ''} onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })} />
            ) : (
              <input
                type={c.tipo === 'data' ? 'date' : c.tipo === 'kg' ? 'text' : 'text'}
                inputMode={c.tipo === 'kg' ? 'decimal' : undefined}
                value={valores[c.chave] ?? ''}
                onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                data-autofocus={i === 0 ? true : undefined}
                required={c.obrigatorio}
              />
            )}
          </label>
        ))}
        {pedeArquivo && (
          <label>
            {arquivoObrigatorio ? 'Arquivo' : 'Trocar o arquivo (opcional)'}
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </form>
    </ModalBase>
  );
}
