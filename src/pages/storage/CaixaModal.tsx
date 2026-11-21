import { useEffect, useRef, useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { IconeFuncao } from '../../components/IconeUso';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { caminhoAnexoStorage, enviarArquivo, removerArquivo, removerArquivos } from '../../lib/storage';
import { BUCKET_STORAGE, useSalvarCaixa, type ItemParaSalvar } from '../../hooks/useStorageCaixas';
import type { AnexoStorage, CaixaStorage, TagItem } from '../../types';
import type { DadosStorage } from './CaixaConteudo';

interface RascunhoAnexo {
  chave: string;
  nome: string;
  caminho: string;
  nomeArquivo: string;
  /** Veio do banco. Os novos já estão no bucket, mas só entram no banco ao salvar. */
  existente: boolean;
  id?: string;
}

interface RascunhoObs {
  chave: string;
  texto: string;
}

interface RascunhoItem {
  id: string;
  existente: boolean;
  nome: string;
  quantidade: string;
  tagId: string;
  obs: RascunhoObs[];
  anexos: RascunhoAnexo[];
  anexosRemovidos: AnexoStorage[];
  anexosAbertos: boolean;
}

function novoItem(): RascunhoItem {
  return { id: crypto.randomUUID(), existente: false, nome: '', quantidade: '', tagId: '', obs: [], anexos: [], anexosRemovidos: [], anexosAbertos: false };
}

function itensIniciais(caixa: CaixaStorage | null, dados: DadosStorage): RascunhoItem[] {
  if (!caixa) return [];
  return (dados.itensPorCaixa.get(caixa.id) ?? []).map((item) => ({
    id: item.id,
    existente: true,
    nome: item.nome,
    quantidade: item.quantidade === null ? '' : String(item.quantidade),
    tagId: item.tag_id ?? '',
    obs: (dados.obsPorItem.get(item.id) ?? []).map((o) => ({ chave: o.id, texto: o.texto })),
    anexos: (dados.anexosPorItem.get(item.id) ?? []).map((a) => ({
      chave: a.id,
      id: a.id,
      nome: a.nome,
      caminho: a.arquivo_url,
      nomeArquivo: a.nome_arquivo,
      existente: true,
    })),
    anexosRemovidos: [],
    anexosAbertos: false,
  }));
}

/** O que identifica "mexeu em algo", pra perguntar antes de descartar. */
function assinatura(nome: string, itens: RascunhoItem[], removidos: string[]): string {
  return JSON.stringify([
    nome,
    removidos,
    itens.map((i) => [i.id, i.nome, i.quantidade, i.tagId, i.obs.map((o) => o.texto), i.anexos.map((a) => a.chave), i.anexosRemovidos.length]),
  ]);
}

function anexosNovosDe(itens: RascunhoItem[]): string[] {
  return itens.flatMap((i) => i.anexos.filter((a) => !a.existente).map((a) => a.caminho));
}

interface CaixaModalProps {
  /** null = caixa nova. */
  caixa: CaixaStorage | null;
  dados: DadosStorage;
  /** Tags (cômodos), as mesmas dos itens de Apartamento. */
  tags: TagItem[];
  /** Posição da caixa nova (última + 1). */
  ordemNova: number;
  onFechar: () => void;
  /** Depois de salvar; recebe o id da caixa. */
  onSalvo: (caixaId: string) => void;
}

/** Formulário da caixa: nome e lista de itens (nome, quantidade, tag, observações e anexos). Padrões A e B da skill padrao-ps. */
export function CaixaModal({ caixa, dados, tags, ordemNova, onFechar, onSalvo }: CaixaModalProps) {
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const salvarCaixa = useSalvarCaixa();

  // O id nasce no navegador pra os anexos enviados durante a criação já terem a pasta certa.
  const [caixaId] = useState(() => caixa?.id ?? crypto.randomUUID());
  const [nome, setNome] = useState(caixa?.nome ?? '');
  const [itens, setItens] = useState<RascunhoItem[]>(() => itensIniciais(caixa, dados));
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [assinaturaInicial] = useState(() => assinatura(caixa?.nome ?? '', itensIniciais(caixa, dados), []));
  // Os anexos enviados e ainda não salvos precisam ser apagados ao fechar; o ref guarda sempre a lista atual.
  const itensRef = useRef(itens);
  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);

  const editando = caixa !== null;
  const mexeu = assinatura(nome, itens, removidos) !== assinaturaInicial;

  function atualizarItem(id: string, patch: Partial<RascunhoItem>) {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function removerItem(item: RascunhoItem) {
    const novos = item.anexos.filter((a) => !a.existente);
    if (novos.length > 0) {
      const ok = await confirmar({
        titulo: 'Remover item?',
        mensagem: `Os anexos enviados para "${item.nome || 'este item'}" também serão apagados.`,
        confirmarRotulo: 'Remover',
        perigoso: true,
      });
      if (!ok) return;
      try {
        await removerArquivos(BUCKET_STORAGE, novos.map((a) => a.caminho));
      } catch (err) {
        mostrarToast(mensagemDeErro(err), 'erro');
        return;
      }
    }
    setItens((atual) => atual.filter((i) => i.id !== item.id));
    if (item.existente) setRemovidos((atual) => [...atual, item.id]);
  }

  async function fechar() {
    if (mexeu) {
      const ok = await confirmar({
        titulo: editando ? 'Descartar as alterações?' : 'Descartar esta caixa?',
        mensagem: 'O que você preencheu não será salvo.',
        confirmarRotulo: 'Descartar',
        perigoso: true,
      });
      if (!ok) return;
    }
    // Anexo enviado e não salvo não pode ficar no bucket.
    const caminhos = anexosNovosDe(itensRef.current);
    if (caminhos.length > 0) {
      try {
        await removerArquivos(BUCKET_STORAGE, caminhos);
      } catch {
        /* melhor esforço: falha ao apagar do bucket não trava o fechamento */
      }
    }
    onFechar();
  }

  async function salvar() {
    if (!nome.trim()) {
      mostrarToast('Dê um nome à caixa.', 'erro');
      return;
    }
    const preenchidos = itens.filter((i) => i.nome.trim() || i.quantidade.trim() || i.obs.some((o) => o.texto.trim()) || i.anexos.length > 0 || i.tagId);
    if (preenchidos.some((i) => !i.nome.trim())) {
      mostrarToast('Dê um nome ao item antes de salvar.', 'erro');
      return;
    }
    if (preenchidos.some((i) => i.quantidade.trim() && !/^[1-9]\d*$/.test(i.quantidade.trim()))) {
      mostrarToast('A quantidade deve ser um número inteiro maior que zero.', 'erro');
      return;
    }
    // Item existente que ficou totalmente vazio é tratado como removido.
    const vazios = itens.filter((i) => !preenchidos.includes(i));
    const itensParaSalvar: ItemParaSalvar[] = preenchidos.map((i) => ({
      id: i.id,
      nome: i.nome.trim(),
      quantidade: i.quantidade.trim() ? Number(i.quantidade.trim()) : null,
      tag_id: i.tagId || null,
      obs: i.obs.map((o) => o.texto.trim()).filter(Boolean),
      anexosNovos: i.anexos.filter((a) => !a.existente).map((a) => ({ nome: a.nome, arquivo_url: a.caminho, nome_arquivo: a.nomeArquivo })),
      anexosRemovidos: i.anexosRemovidos,
    }));
    setSalvando(true);
    try {
      await salvarCaixa.mutateAsync({
        id: caixaId,
        nome: nome.trim(),
        novo: !editando,
        ordemNova,
        itens: itensParaSalvar,
        itensRemovidos: [...removidos, ...vazios.filter((i) => i.existente).map((i) => i.id)],
      });
      mostrarToast('Caixa salva.');
      onSalvo(caixaId);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase aberto rotulo={editando ? `Editar caixa ${caixa.nome}` : 'Nova caixa'} onFechar={fechar} classe="modal-edicao modal-storage">
      <h3 className="modal-titulo">{editando ? 'Editar caixa' : 'Nova caixa'}</h3>
      <label>
        Nome da caixa
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus />
      </label>

      <div className="storage-form-itens">
        <h4>Itens</h4>
        {itens.map((item) => (
          <LinhaItem
            key={item.id}
            item={item}
            tags={tags}
            onChange={(patch) => atualizarItem(item.id, patch)}
            onRemover={() => removerItem(item)}
          />
        ))}
        {itens.length === 0 && <p className="hierarquia-vazio">Nenhum item ainda.</p>}
        <button type="button" onClick={() => setItens((atual) => [...atual, novoItem()])}>
          + Item
        </button>
      </div>

      <div className="modal-acoes">
        <button type="button" className="btn-icone" onClick={salvar} disabled={!nome.trim() || salvando} title="Salvar caixa" aria-label="Salvar caixa">
          <IconeFuncao funcao="salvar" />
        </button>
        <button type="button" className="btn-icone btn-icone-perigo" onClick={fechar} title="Cancelar" aria-label="Cancelar">
          <IconeFuncao funcao="excluir" />
        </button>
      </div>
    </ModalBase>
  );
}

function LinhaItem({
  item,
  tags,
  onChange,
  onRemover,
}: {
  item: RascunhoItem;
  tags: TagItem[];
  onChange: (patch: Partial<RascunhoItem>) => void;
  onRemover: () => void;
}) {
  const rotulo = item.nome || 'item sem nome';
  return (
    <div className="storage-form-item">
      <div className="storage-form-item-linha">
        <input type="text" placeholder="Nome do item" aria-label="Nome do item" value={item.nome} onChange={(e) => onChange({ nome: e.target.value })} />
        <input
          type="number"
          min={1}
          step={1}
          placeholder="Qtd."
          aria-label={`Quantidade de ${rotulo}`}
          value={item.quantidade}
          onChange={(e) => onChange({ quantidade: e.target.value })}
        />
        <button
          type="button"
          className="btn-icone btn-icone-perigo"
          onClick={onRemover}
          title={`Remover ${rotulo}`}
          aria-label={`Remover ${rotulo}`}
        >
          <IconeFuncao funcao="excluir" />
        </button>
      </div>
      <div className="storage-form-item-linha">
        <select value={item.tagId} onChange={(e) => onChange({ tagId: e.target.value })} aria-label={`Tag de ${rotulo}`}>
          <option value="">Sem tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-icone"
          onClick={() => onChange({ obs: [...item.obs, { chave: crypto.randomUUID(), texto: '' }] })}
          title={`Adicionar observação em ${rotulo}`}
          aria-label={`Adicionar observação em ${rotulo}`}
        >
          <IconeFuncao funcao="adicionar" />
        </button>
        <button
          type="button"
          className="arquivo-link"
          aria-expanded={item.anexosAbertos}
          onClick={() => onChange({ anexosAbertos: !item.anexosAbertos })}
          title={`Fotos e anexos de ${rotulo}`}
          aria-label={`Fotos e anexos de ${rotulo}`}
        >
          Anexos ({item.anexos.length})
        </button>
      </div>

      {item.obs.map((o) => (
        <div key={o.chave} className="storage-form-item-linha">
          <input
            type="text"
            placeholder="Observação"
            aria-label={`Observação de ${rotulo}`}
            value={o.texto}
            onChange={(e) => onChange({ obs: item.obs.map((x) => (x.chave === o.chave ? { ...x, texto: e.target.value } : x)) })}
          />
          <button
            type="button"
            className="btn-icone btn-icone-perigo"
            onClick={() => onChange({ obs: item.obs.filter((x) => x.chave !== o.chave) })}
            title="Remover observação"
            aria-label={`Remover observação de ${rotulo}`}
          >
            <IconeFuncao funcao="excluir" />
          </button>
        </div>
      ))}

      {item.anexosAbertos && <AnexosDoItem item={item} onChange={onChange} />}
    </div>
  );
}

/** Bloco de anexos (Padrão B) de um item: o arquivo vai pro bucket na hora, mas só entra no banco ao salvar a caixa. */
function AnexosDoItem({ item, onChange }: { item: RascunhoItem; onChange: (patch: Partial<RascunhoItem>) => void }) {
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!arquivo || !nome.trim()) return;
    setEnviando(true);
    try {
      const caminho = caminhoAnexoStorage(item.id, nome.trim(), arquivo);
      await enviarArquivo(BUCKET_STORAGE, caminho, arquivo);
      onChange({ anexos: [...item.anexos, { chave: crypto.randomUUID(), nome: nome.trim(), caminho, nomeArquivo: arquivo.name, existente: false }] });
      setArquivo(null);
      setNome('');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function remover(anexo: RascunhoAnexo) {
    const ok = await confirmar({ titulo: 'Remover anexo?', mensagem: anexo.nome, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    if (anexo.existente) {
      // Já está no banco: só some de verdade ao salvar a caixa.
      onChange({
        anexos: item.anexos.filter((a) => a.chave !== anexo.chave),
        anexosRemovidos: [
          ...item.anexosRemovidos,
          { id: anexo.id ?? anexo.chave, item_id: item.id, nome: anexo.nome, arquivo_url: anexo.caminho, nome_arquivo: anexo.nomeArquivo },
        ],
      });
      return;
    }
    try {
      await removerArquivo(BUCKET_STORAGE, anexo.caminho);
      onChange({ anexos: item.anexos.filter((a) => a.chave !== anexo.chave) });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="documentos-secao">
      <ul className="lista-documentos">
        {item.anexos.map((anexo) => (
          <li key={anexo.chave}>
            <span>{anexo.nome}</span>
            <button
              type="button"
              className="btn-icone btn-icone-perigo"
              onClick={() => remover(anexo)}
              title="Remover anexo"
              aria-label={`Remover anexo ${anexo.nome}`}
            >
              <IconeFuncao funcao="excluir" />
            </button>
          </li>
        ))}
        {item.anexos.length === 0 && <li className="hierarquia-vazio">Nenhum anexo ainda.</li>}
      </ul>
      <div className="upload-form">
        <input type="text" placeholder="Nome do arquivo" aria-label="Nome do arquivo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input type="file" aria-label="Selecionar arquivo" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={enviar} disabled={!arquivo || !nome.trim() || enviando}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </div>
    </div>
  );
}
