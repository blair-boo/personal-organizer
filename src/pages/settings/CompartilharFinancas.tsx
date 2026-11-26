import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { useDefinirAcessoFinancas, useFinancasAcessos } from '../../hooks/useFinancasAcessos';
import { useNomesUsuarios } from '../../hooks/useNomesUsuarios';
import { usePerfis } from '../../hooks/useUsuarios';
import { mensagemDeErro } from '../../lib/erros';
import { pessoasQueLiberaram } from '../../lib/financas';
import type { NivelAcessoFinancas } from '../../types';

const NINGUEM = 'ninguem';

/**
 * Settings > Usuários: com quem eu divido as minhas finanças (nada, só ver ou ver e editar)
 * e quem liberou as dele para mim. O banco aplica o acesso, não só a tela.
 */
export function CompartilharFinancas() {
  const meuId = useAuth().session?.user.id;
  const nomeDe = useNomesUsuarios();
  const { mostrarToast } = useToast();
  const { data: perfis, isLoading: carregandoPerfis, isError: erroPerfis } = usePerfis();
  const { data: acessos, isLoading: carregandoAcessos, isError: erroAcessos } = useFinancasAcessos();
  const definir = useDefinirAcessoFinancas();

  const outros = (perfis ?? []).filter((p) => p.usuario_id !== meuId);
  const recebidos = pessoasQueLiberaram(acessos ?? [], meuId);

  async function mudar(convidadoId: string, valor: string) {
    try {
      await definir.mutateAsync({ convidadoId, nivel: valor === NINGUEM ? null : (valor as NivelAcessoFinancas) });
      mostrarToast('Acesso atualizado.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <section className="compartilhar-financas">
      <h3>Compartilhar minhas finanças</h3>
      <p className="conta-detalhe">
        Quem puder ver aparece no seletor de Finanças. Quem puder editar também cria e altera contas e lançamentos seus.
      </p>

      {carregandoPerfis || carregandoAcessos ? (
        <p>Carregando…</p>
      ) : erroPerfis || erroAcessos ? (
        <p role="alert">Não foi possível carregar os acessos.</p>
      ) : outros.length === 0 ? (
        <p className="hierarquia-vazio">Nenhum outro usuário para compartilhar ainda.</p>
      ) : (
        <ul className="lista-contas">
          {outros.map((p) => {
            const atual = (acessos ?? []).find((a) => a.dono_id === meuId && a.convidado_id === p.usuario_id)?.nivel ?? NINGUEM;
            return (
              <li key={p.usuario_id}>
                <div>
                  <strong>{nomeDe(p.usuario_id)}</strong>
                  <span className="conta-detalhe">{p.email}</span>
                </div>
                <select
                  value={atual}
                  onChange={(e) => void mudar(p.usuario_id, e.target.value)}
                  disabled={definir.isPending}
                  aria-label={`Acesso de ${nomeDe(p.usuario_id)} às minhas finanças`}
                >
                  <option value={NINGUEM}>Ninguém</option>
                  <option value="ver">Pode ver</option>
                  <option value="editar">Pode ver e editar</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}

      {recebidos.length > 0 && (
        <>
          <h4>Compartilhadas comigo</h4>
          <ul className="lista-contas">
            {recebidos.map((r) => (
              <li key={r.usuarioId}>
                <strong>{nomeDe(r.usuarioId)}</strong>
                <span className="conta-detalhe">{r.nivel === 'editar' ? 'Você pode ver e editar' : 'Você pode ver'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
