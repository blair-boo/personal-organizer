import { useState } from 'react';
import { ModalBase } from './ModalBase';
import { useToast } from './Toast';
import { IconeDoUso } from './IconeUso';
import { ModalIcone } from './ModalIcone';
import { useIconesUsos, useSalvarUsoIcone } from '../hooks/useIconesUsos';
import { useRotulosAlvos } from '../hooks/useRotulosAlvos';
import { useTemaEfetivo } from '../hooks/useTema';
import { mensagemDeErro } from '../lib/erros';
import { FUNCOES_ICONE, usoPadraoDaFuncao } from '../lib/iconesFuncoes';
import { resolverUso } from '../lib/iconesUsos';
import type { UsoIcone } from '../types';

interface ModalAtribuirIconeProps {
  /** Ícone da galeria que será atribuído. */
  icone: { pasta: string; nome: string };
  onFechar: () => void;
}

interface Alvo {
  uso: UsoIcone;
  rotulo: string;
}

/**
 * Atribui um ícone da galeria a um lugar do app que já tem ícone (função, categoria ou aba).
 * Escolhido o lugar, abre o modal de ícone com este ícone pré-selecionado para ajustar e confirmar.
 */
export function ModalAtribuirIcone({ icone, onFechar }: ModalAtribuirIconeProps) {
  const { data: usos = [], isLoading, isError, error } = useIconesUsos();
  const rotuloDe = useRotulosAlvos();
  const tema = useTemaEfetivo();
  const salvar = useSalvarUsoIcone();
  const { mostrarToast } = useToast();
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState<Alvo | null>(null);

  const funcoes: Alvo[] = FUNCOES_ICONE.flatMap((def) => {
    const uso = resolverUso(usos, 'funcao', def.chave, tema) ?? usoPadraoDaFuncao(def.chave);
    return uso ? [{ uso, rotulo: def.rotulo }] : [];
  });
  const titulos: Alvo[] = [];
  const vistos = new Set<string>();
  for (const u of usos) {
    if (u.alvo_tipo === 'funcao') continue;
    const chave = `${u.alvo_tipo}:${u.alvo_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    titulos.push({ uso: resolverUso(usos, u.alvo_tipo, u.alvo_id, tema) ?? u, rotulo: rotuloDe(u.alvo_tipo, u.alvo_id) });
  }

  const termo = busca.trim().toLowerCase();
  const filtrar = (lista: Alvo[]) => lista.filter((a) => a.rotulo.toLowerCase().includes(termo));
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
            <li key={`${a.uso.alvo_tipo}:${a.uso.alvo_id}`}>
              <button type="button" onClick={() => setAlvo(a)} title={`Atribuir a ${a.rotulo}`} aria-label={`Atribuir a ${a.rotulo}`}>
                <IconeDoUso uso={a.uso} tamanhoBase={18} />
                {a.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (alvo) {
    return (
      <ModalIcone
        aberto
        rotuloAlvo={alvo.rotulo}
        alvoTipo={alvo.uso.alvo_tipo}
        alvoId={alvo.uso.alvo_id}
        inicial={{ ...alvo.uso, icone_pasta: icone.pasta, icone_arquivo: icone.nome }}
        tamanhoBase={16}
        permiteRemover={false}
        onConfirmar={(uso) => void aoConfirmar(uso)}
        onFechar={() => setAlvo(null)}
      />
    );
  }

  return (
    <ModalBase aberto rotulo={`Atribuir ${icone.nome}`} onFechar={onFechar} classe="modal-usos">
      <h2 className="modal-titulo">Atribuir {icone.nome}</h2>
      <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lugar…" aria-label="Buscar lugar" />
      {isLoading && <p className="hierarquia-vazio">Carregando…</p>}
      {isError && <p className="testes-erro">Não foi possível carregar os lugares: {mensagemDeErro(error)}</p>}
      {!isLoading && !isError && semResultado && <p className="hierarquia-vazio">{termo ? 'Nenhum resultado.' : 'Nenhum lugar com ícone ainda.'}</p>}
      {lista('Funções', funcoesVisiveis)}
      {lista('Títulos (categorias e abas)', titulosVisiveis)}
    </ModalBase>
  );
}
