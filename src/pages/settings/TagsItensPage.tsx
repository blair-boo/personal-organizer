import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { useCriarTagItem, useExcluirTagItem, useRenomearTagItem, useTagsItens } from '../../hooks/useTagsItens';
import type { TagItem } from '../../types';

export function TagsItensPage() {
  const { data: tags, isLoading } = useTagsItens();
  const criar = useCriarTagItem();
  const renomear = useRenomearTagItem();
  const excluir = useExcluirTagItem();
  const { confirmar, pedirTexto } = useDialogos();
  const { mostrarToast } = useToast();

  async function adicionar() {
    const nome = await pedirTexto({ titulo: 'Nova tag', mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      await criar.mutateAsync(nome.trim());
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function editar(item: TagItem) {
    const nome = await pedirTexto({ titulo: 'Renomear', mensagem: 'Nome', valorInicial: item.nome });
    if (!nome?.trim() || nome.trim() === item.nome) return;
    try {
      await renomear.mutateAsync({ id: item.id, nome: nome.trim() });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function remover(item: TagItem) {
    const ok = await confirmar({
      titulo: `Excluir a tag "${item.nome}"?`,
      mensagem: 'Itens que usam essa tag ficam sem ela.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(item.id);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="settings-secao">
      <h2>Tags de itens</h2>
      <p className="settings-secao-ajuda">
        Usadas pra filtrar os itens do apartamento (um item pode ter mais de uma tag) — ex.: cozinha, eletrodoméstico, móvel.
      </p>
      <div className="hierarquia-topo">
        <button type="button" onClick={adicionar}>
          + Tag
        </button>
      </div>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(tags ?? []).map((item) => (
            <li key={item.id}>
              <strong>{item.nome}</strong>
              <div className="hierarquia-item-acoes">
                <button type="button" className="btn-icone" onClick={() => editar(item)} aria-label="Renomear">
                  ✎
                </button>
                <button type="button" className="btn-icone btn-icone-perigo" onClick={() => remover(item)} aria-label="Excluir">
                  🗑
                </button>
              </div>
            </li>
          ))}
          {tags?.length === 0 && <p className="hierarquia-vazio">Nenhuma tag cadastrada ainda.</p>}
        </ul>
      )}
    </div>
  );
}
