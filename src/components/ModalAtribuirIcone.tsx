import { useState } from 'react';
import { ModalBase } from './ModalBase';
import { useToast } from './Toast';
import { IconeDoUso, IconeFuncao } from './IconeUso';
import { ModalIcone } from './ModalIcone';
import { useCategorias } from '../hooks/useCategorias';
import { useDocumentosPessoas } from '../hooks/useDocumentos';
import { useIconesUsos, useSalvarUsoIcone } from '../hooks/useIconesUsos';
import { useRotulosAlvos } from '../hooks/useRotulosAlvos';
import { useStorageCaixas } from '../hooks/useStorageCaixas';
import { useTemaEfetivo } from '../hooks/useTema';
import { ABAS_PADRAO } from '../lib/abas';
import { mensagemDeErro } from '../lib/erros';
import { FUNCOES_ICONE, usoPadraoDaFuncao } from '../lib/iconesFuncoes';
import { resolverUso } from '../lib/iconesUsos';
import type { AlvoIcone, UsoIcone } from '../types';

interface ModalAtribuirIconeProps {
  /** Ícone da galeria que será atribuído. */
  icone: { pasta: string; nome: string };
  onFechar: () => void;
}

interface Alvo {
  alvoTipo: AlvoIcone;
  alvoId: string;
  /** Uso atual do lugar; null = ainda sem ícone. */
  uso: UsoIcone | null;
  rotulo: string;
}

/**
 * Atribui um ícone da galeria a um lugar do app (função, categoria, aba, pessoa ou caixa).
 * Escolhido o lugar, abre o modal de ícone com este ícone já selecionado, só para ajustar e confirmar.
 * O botão "?" mostra apenas os lugares que ainda não têm ícone.
 */
export function ModalAtribuirIcone({ icone, onFechar }: ModalAtribuirIconeProps) {
  const { data: usos = [], isLoading, isError, error } = useIconesUsos();
  const { data: despesas = [] } = useCategorias('despesa');
  const { data: receitas = [] } = useCategorias('receita');
  const { data: pessoas = [] } = useDocumentosPessoas();
  const { data: caixas = [] } = useStorageCaixas();
  const rotuloDe = useRotulosAlvos();
  const tema = useTemaEfetivo();
  const salvar = useSalvarUsoIcone();
  const { mostrarToast } = useToast();
  const [busca, setBusca] = useState('');
  const [soSemIcone, setSoSemIcone] = useState(false);
  const [alvo, setAlvo] = useState<Alvo | null>(null);

  function alvoDe(alvoTipo: AlvoIcone, alvoId: string, uso: UsoIcone | null): Alvo {
    return { alvoTipo, alvoId, uso, rotulo: rotuloDe(alvoTipo, alvoId) };
  }

  const funcoes: Alvo[] = FUNCOES_ICONE.map((def) => alvoDe('funcao', def.chave, resolverUso(usos, 'funcao', def.chave, tema) ?? usoPadraoDaFuncao(def.chave)));

  const titulos: Alvo[] = [
    ...Object.values(ABAS_PADRAO).flat().map((a) => ({ tipo: 'aba' as const, id: a.chave })),
    ...[...despesas, ...receitas].map((c) => ({ tipo: 'categoria' as const, id: c.id })),
    ...pessoas.map((p) => ({ tipo: 'pessoa' as const, id: p.id })),
    ...caixas.map((c) => ({ tipo: 'caixa' as const, id: c.id })),
  ].map(({ tipo, id }) => alvoDe(tipo, id, resolverUso(usos, tipo, id, tema)));

  const semIcone = [...funcoes, ...titulos].filter((a) => a.uso === null);

  const termo = busca.trim().toLowerCase();
  const filtrar = (lista: Alvo[]) => lista.filter((a) => (!soSemIcone || a.uso === null) && a.rotulo.toLowerCase().includes(termo));
  const funcoesVisiveis = filtrar(funcoes);
  const titulosVisiveis = filtrar(titulos);
  const semResultado = funcoesVisiveis.length === 0 && titulosVisiveis.length === 0;

  async function aoConfirmar(uso: UsoIcone) {
    try {
      await salvar.mutateAsync(uso);
      mostrarToast('Ícone atribuído.');
      onFechar();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function lista(titulo: string, itens: Alvo[]) {
    if (itens.length === 0) return null;
    return (
      <section className="modal-atribuir-grupo">
        <h3>{titulo}</h3>
        <ul className="modal-atribuir-lista">
          {itens.map((a) => (
            <li key={`${a.alvoTipo}:${a.alvoId}`}>
              <button type="button" onClick={() => setAlvo(a)} title={`Atribuir a ${a.rotulo}`} aria-label={`Atribuir a ${a.rotulo}`}>
                {a.uso ? <IconeDoUso uso={a.uso} tamanhoBase={18} /> : <span className="modal-atribuir-sem-icone" aria-hidden="true" />}
                {a.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (alvo) {
    const inicial: UsoIcone = {
      alvo_tipo: alvo.alvoTipo,
      alvo_id: alvo.alvoId,
      tamanho_delta: 0,
      mascara: true,
      cor_origem: 'padrao',
      cor_valor: null,
      tema: 'ambos',
      ...(alvo.uso ?? {}),
      icone_pasta: icone.pasta,
      icone_arquivo: icone.nome,
    };
    return (
      <ModalIcone
        aberto
        rotuloAlvo={alvo.rotulo}
        alvoTipo={alvo.alvoTipo}
        alvoId={alvo.alvoId}
        inicial={inicial}
        tamanhoBase={16}
        permiteRemover={false}
        ocultarSeletor
        onConfirmar={(uso) => void aoConfirmar(uso)}
        onFechar={() => setAlvo(null)}
      />
    );
  }

  return (
    <ModalBase aberto rotulo={`Atribuir ${icone.nome}`} onFechar={onFechar} classe="modal-usos" titulo={`Atribuir ${icone.nome}`} perguntarAoDescartar={false}>
      <div className="modal-atribuir-busca">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lugar…" aria-label="Buscar lugar" />
        <button
          type="button"
          className={`btn-icone modal-atribuir-filtro${soSemIcone ? ' ativo' : ''}`}
          onClick={() => setSoSemIcone((v) => !v)}
          aria-pressed={soSemIcone}
          title={soSemIcone ? 'Mostrar todos os lugares' : 'Mostrar só os lugares sem ícone'}
          aria-label={soSemIcone ? 'Mostrar todos os lugares' : `Mostrar só os lugares sem ícone (${semIcone.length})`}
        >
          <IconeFuncao funcao="filtro_sem_icone" tamanho={22} />
          <span className="modal-atribuir-contagem">{semIcone.length}</span>
        </button>
      </div>
      {isLoading && <p className="hierarquia-vazio">Carregando…</p>}
      {isError && <p className="testes-erro">Não foi possível carregar os lugares: {mensagemDeErro(error)}</p>}
      {!isLoading && !isError && semResultado && <p className="hierarquia-vazio">{termo ? 'Nenhum resultado.' : soSemIcone ? 'Todos os lugares já têm ícone.' : 'Nenhum lugar encontrado.'}</p>}
      <div className="modal-atribuir-conteudo">
        {lista('Funções', funcoesVisiveis)}
        {lista('Títulos (abas, categorias, pessoas e caixas)', titulosVisiveis)}
      </div>
    </ModalBase>
  );
}
