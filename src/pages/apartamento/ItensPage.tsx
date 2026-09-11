import { useState, type FormEvent } from 'react';
import { IconeSupabase } from '../../components/IconeSupabase';
import { ModalBase } from '../../components/ModalBase';
import { ArquivoLink } from '../../components/ArquivoLink';
import { TagMultiSelect } from '../../components/TagMultiSelect';
import { TagsChips } from '../../components/TagsChips';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarMoeda, formatarData } from '../../lib/datas';
import { useTagsItens } from '../../hooks/useTagsItens';
import { useDefinirTagsItem, useTodosItemTags } from '../../hooks/useItemTags';
import { useAtualizarItem, useCriarItem, useExcluirItem, useItens, type DadosItem } from '../../hooks/useItens';
import {
  useAdicionarDocumentoItem,
  useItemDocumentos,
  useRemoverDocumentoItem,
} from '../../hooks/useItemDocumentos';
import type { Item, ItemDocumento, TipoDocumentoItem } from '../../types';

const ITEM_VAZIO: DadosItem = {
  nome: '',
  marca: null,
  modelo: null,
  data_compra: null,
  garantia_ate: null,
  valor: null,
  observacoes: null,
};

const TIPO_DOC_LABEL: Record<TipoDocumentoItem, string> = {
  nota_fiscal: 'Nota fiscal',
  manual: 'Manual',
  outro: 'Outro',
};

function SecaoDocumentos({ item }: { item: Item }) {
  const { data: documentos, isLoading } = useItemDocumentos(item.id);
  const adicionar = useAdicionarDocumentoItem(item.id, item.nome);
  const remover = useRemoverDocumentoItem(item.id);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoDocumentoItem>('nota_fiscal');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    if (tipo === 'outro' && !descricao.trim()) {
      mostrarToast('Descreva o que é esse documento.', 'erro');
      return;
    }
    setEnviando(true);
    try {
      await adicionar.mutateAsync({ arquivo, tipo, descricao: tipo === 'outro' ? descricao.trim() : null });
      setArquivo(null);
      setDescricao('');
      mostrarToast('Documento anexado.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(doc: ItemDocumento) {
    const ok = await confirmar({ titulo: 'Remover documento?', mensagem: doc.nome_arquivo, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    try {
      await remover.mutateAsync(doc);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="documentos-secao">
      <h4>Notas fiscais, manuais e outros</h4>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-documentos">
          {(documentos ?? []).map((doc) => (
            <li key={doc.id}>
              <ArquivoLink bucket="itens-docs" caminho={doc.arquivo_url}>
                {TIPO_DOC_LABEL[doc.tipo]}
                {doc.descricao ? ` — ${doc.descricao}` : ''}
              </ArquivoLink>
              <button type="button" className="btn-icone btn-icone-perigo" onClick={() => handleRemover(doc)} aria-label="Remover">
                <IconeSupabase arquivo="trash3.svg" />
              </button>
            </li>
          ))}
          {documentos?.length === 0 && <li className="hierarquia-vazio">Nenhum documento anexado ainda.</li>}
        </ul>
      )}
      <form className="upload-form" onSubmit={handleUpload}>
        <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} accept="application/pdf,image/*" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoItem)}>
          <option value="nota_fiscal">Nota fiscal</option>
          <option value="manual">Manual</option>
          <option value="outro">Outro</option>
        </select>
        {tipo === 'outro' && (
          <input type="text" placeholder="O que é esse arquivo?" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        )}
        <button type="submit" disabled={!arquivo || enviando}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </form>
    </div>
  );
}

function FormularioItem({
  inicial,
  tagsIniciais,
  todasTags,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosItem;
  tagsIniciais: string[];
  todasTags: { id: string; nome: string }[];
  onSalvar: (dados: DadosItem, tagIds: string[]) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosItem>(inicial);
  const [tagIds, setTagIds] = useState<string[]>(tagsIniciais);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(dados, tagIds);
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
        Tags
        <TagMultiSelect todasTags={todasTags} selecionadas={tagIds} onChange={setTagIds} />
      </label>
      <label>
        Marca
        <input type="text" value={dados.marca ?? ''} onChange={(e) => setDados({ ...dados, marca: e.target.value || null })} />
      </label>
      <label>
        Modelo
        <input type="text" value={dados.modelo ?? ''} onChange={(e) => setDados({ ...dados, modelo: e.target.value || null })} />
      </label>
      <label>
        Data da compra
        <input
          type="date"
          value={dados.data_compra ?? ''}
          onChange={(e) => setDados({ ...dados, data_compra: e.target.value || null })}
        />
      </label>
      <label>
        Garantia até
        <input
          type="date"
          value={dados.garantia_ate ?? ''}
          onChange={(e) => setDados({ ...dados, garantia_ate: e.target.value || null })}
        />
      </label>
      <label>
        Valor
        <input
          type="number"
          step="0.01"
          value={dados.valor ?? ''}
          onChange={(e) => setDados({ ...dados, valor: e.target.value ? Number(e.target.value) : null })}
        />
      </label>
      <label>
        Observações
        <textarea
          value={dados.observacoes ?? ''}
          onChange={(e) => setDados({ ...dados, observacoes: e.target.value || null })}
        />
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

export function ItensPage() {
  const { data: itens, isLoading } = useItens();
  const { data: todasTags } = useTagsItens();
  const { data: itemTags } = useTodosItemTags();
  const criar = useCriarItem();
  const atualizar = useAtualizarItem();
  const excluir = useExcluirItem();
  const definirTags = useDefinirTagsItem();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(item: Item) {
    setEditando(item);
    setModalAberto(true);
  }

  async function salvar(dados: DadosItem, tagIds: string[]) {
    try {
      const itemId = editando ? editando.id : (await criar.mutateAsync(dados)).id;
      if (editando) await atualizar.mutateAsync({ id: editando.id, dados });
      await definirTags.mutateAsync({ itemId, tagIds });
      mostrarToast('Item salvo.');
      if (!editando) setModalAberto(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarExcluir(item: Item) {
    const ok = await confirmar({
      titulo: `Excluir "${item.nome}"?`,
      mensagem: 'Os documentos anexados também serão excluídos.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(item.id);
      setModalAberto(false);
      mostrarToast('Item excluído.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="settings-secao">
      <h2>Itens do apartamento</h2>
      <button type="button" onClick={abrirNovo}>
        + Item
      </button>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(itens ?? []).map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.nome}</strong>
                <span className="conta-detalhe">
                  <TagsChips tags={itemTags?.get(item.id)} />
                  {item.valor != null && ` · ${formatarMoeda(item.valor)}`}
                </span>
              </div>
              <button type="button" className="btn-icone" onClick={() => abrirEdicao(item)} aria-label="Ver/editar">
                ✎
              </button>
            </li>
          ))}
          {itens?.length === 0 && <p className="hierarquia-vazio">Nenhum item cadastrado ainda.</p>}
        </ul>
      )}
      <ModalBase aberto={modalAberto} rotulo={editando ? editando.nome : 'Novo item'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar item' : 'Novo item'}</h3>
        <FormularioItem
          inicial={
            editando
              ? {
                  nome: editando.nome,
                  marca: editando.marca,
                  modelo: editando.modelo,
                  data_compra: editando.data_compra,
                  garantia_ate: editando.garantia_ate,
                  valor: editando.valor,
                  observacoes: editando.observacoes,
                }
              : ITEM_VAZIO
          }
          tagsIniciais={editando ? (itemTags?.get(editando.id) ?? []).map((t) => t.id) : []}
          todasTags={todasTags ?? []}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
        {editando && (
          <>
            <SecaoDocumentos item={editando} />
            <button type="button" className="botao-perigoso" onClick={() => tratarExcluir(editando)}>
              Excluir item
            </button>
          </>
        )}
        {editando?.garantia_ate && <p className="settings-secao-ajuda">Garantia até {formatarData(editando.garantia_ate)}.</p>}
      </ModalBase>
    </div>
  );
}
