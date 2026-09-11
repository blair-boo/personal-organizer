import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import {
  useClassificacoesTarefas,
  useCriarClassificacaoTarefa,
  useExcluirClassificacaoTarefa,
  useRenomearClassificacaoTarefa,
} from '../../hooks/useClassificacoesTarefas';
import type { ClassificacaoTarefa } from '../../types';

export function ClassificacoesTarefasPage() {
  const { data: classificacoes, isLoading } = useClassificacoesTarefas();
  const criar = useCriarClassificacaoTarefa();
  const renomear = useRenomearClassificacaoTarefa();
  const excluir = useExcluirClassificacaoTarefa();
  const { confirmar, pedirTexto } = useDialogos();
  const { mostrarToast } = useToast();

  async function adicionar() {
    const nome = await pedirTexto({ titulo: 'Nova classificação', mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      await criar.mutateAsync({ nome: nome.trim(), cor: null });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function editar(item: ClassificacaoTarefa) {
    const nome = await pedirTexto({ titulo: 'Renomear', mensagem: 'Nome', valorInicial: item.nome });
    if (!nome?.trim() || nome.trim() === item.nome) return;
    try {
      await renomear.mutateAsync({ id: item.id, nome: nome.trim() });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function remover(item: ClassificacaoTarefa) {
    const ok = await confirmar({
      titulo: `Excluir "${item.nome}"?`,
      mensagem: 'Tarefas que usam essa classificação ficam sem ela.',
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
      <h2>Classificações de tarefas</h2>
      <p className="settings-secao-ajuda">
        Usadas pra filtrar as tarefas de manutenção (uma tarefa pode ter mais de uma classificação).
      </p>
      <div className="hierarquia-topo">
        <button type="button" onClick={adicionar}>
          + Classificação
        </button>
      </div>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(classificacoes ?? []).map((item) => (
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
          {classificacoes?.length === 0 && <p className="hierarquia-vazio">Nenhuma classificação cadastrada ainda.</p>}
        </ul>
      )}
    </div>
  );
}
