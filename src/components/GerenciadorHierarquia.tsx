import { useMemo } from 'react';
import { useDialogos } from './Dialogo';
import { useToast } from './Toast';
import { mensagemDeErro } from '../lib/erros';

interface NoHierarquia {
  id: string;
  nome: string;
  parent_id: string | null;
}

interface GerenciadorHierarquiaProps<T extends NoHierarquia> {
  itens: T[];
  /** Rótulo do nível raiz, ex.: "Categoria" ou "Cômodo". */
  rotuloRaiz: string;
  /** Rótulo do nível filho, ex.: "Subcategoria". */
  rotuloFilho: string;
  onAdicionarRaiz: (nome: string) => Promise<void>;
  onAdicionarFilho: (parentId: string, nome: string) => Promise<void>;
  onRenomear: (id: string, novoNome: string) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
}

/**
 * Gestão de uma hierarquia de 2 níveis (categoria/subcategoria, cômodo/subcategoria):
 * adicionar, renomear e excluir em qualquer nível, via diálogos (useDialogos)
 * em vez de edição inline — mais simples de manter com FK real (rename/delete
 * são UPDATE/DELETE diretos, sem precisar propagar em arrays).
 */
export function GerenciadorHierarquia<T extends NoHierarquia>({
  itens,
  rotuloRaiz,
  rotuloFilho,
  onAdicionarRaiz,
  onAdicionarFilho,
  onRenomear,
  onExcluir,
}: GerenciadorHierarquiaProps<T>) {
  const { confirmar, pedirTexto } = useDialogos();
  const { mostrarToast } = useToast();

  const raizes = useMemo(() => itens.filter((i) => !i.parent_id), [itens]);
  const filhosPorPai = useMemo(() => {
    const mapa = new Map<string, T[]>();
    for (const item of itens) {
      if (!item.parent_id) continue;
      const lista = mapa.get(item.parent_id) ?? [];
      lista.push(item);
      mapa.set(item.parent_id, lista);
    }
    return mapa;
  }, [itens]);

  async function tratarAdicionarRaiz() {
    const nome = await pedirTexto({ titulo: `Nova ${rotuloRaiz.toLowerCase()}`, mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      await onAdicionarRaiz(nome.trim());
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarAdicionarFilho(parentId: string) {
    const nome = await pedirTexto({ titulo: `Nova ${rotuloFilho.toLowerCase()}`, mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      await onAdicionarFilho(parentId, nome.trim());
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarRenomear(item: T) {
    const nome = await pedirTexto({ titulo: 'Renomear', mensagem: 'Nome', valorInicial: item.nome });
    if (!nome?.trim() || nome.trim() === item.nome) return;
    try {
      await onRenomear(item.id, nome.trim());
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarExcluir(item: T, ehRaiz: boolean) {
    const filhos = filhosPorPai.get(item.id) ?? [];
    const aviso = ehRaiz && filhos.length > 0 ? ` Isso também exclui ${filhos.length} subcategoria(s) dentro dela.` : '';
    const ok = await confirmar({
      titulo: `Excluir "${item.nome}"?`,
      mensagem: `Lançamentos que já usam essa classificação ficam sem categoria.${aviso}`,
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await onExcluir(item.id);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="hierarquia">
      <div className="hierarquia-topo">
        <button type="button" onClick={tratarAdicionarRaiz}>
          + {rotuloRaiz}
        </button>
      </div>
      <div className="hierarquia-lista">
        {raizes.length === 0 && <p className="hierarquia-vazio">Nenhuma {rotuloRaiz.toLowerCase()} cadastrada ainda.</p>}
        {raizes.map((raiz) => (
          <div key={raiz.id} className="hierarquia-grupo">
            <div className="hierarquia-item hierarquia-item-raiz">
              <span>{raiz.nome}</span>
              <div className="hierarquia-item-acoes">
                <button type="button" className="btn-icone" onClick={() => tratarRenomear(raiz)} aria-label="Renomear">
                  ✎
                </button>
                <button
                  type="button"
                  className="btn-icone btn-icone-perigo"
                  onClick={() => tratarExcluir(raiz, true)}
                  aria-label="Excluir"
                >
                  🗑
                </button>
              </div>
            </div>
            <div className="hierarquia-filhos">
              {(filhosPorPai.get(raiz.id) ?? []).map((filho) => (
                <div key={filho.id} className="hierarquia-item hierarquia-item-filho">
                  <span>{filho.nome}</span>
                  <div className="hierarquia-item-acoes">
                    <button type="button" className="btn-icone" onClick={() => tratarRenomear(filho)} aria-label="Renomear">
                      ✎
                    </button>
                    <button
                      type="button"
                      className="btn-icone btn-icone-perigo"
                      onClick={() => tratarExcluir(filho, false)}
                      aria-label="Excluir"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="hierarquia-add-filho" onClick={() => tratarAdicionarFilho(raiz.id)}>
                + {rotuloFilho}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
