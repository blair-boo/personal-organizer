import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistoricoPessoas, useHistoricoTarefas } from '../../hooks/useTarefasHistorico';
import { useTarefasManutencao } from '../../hooks/useTarefasManutencao';
import { useCasalMembros, useDocumentosPessoas } from '../../hooks/useDocumentos';
import { useProximasDatasGatos } from '../../hooks/useProximasDatasGatos';
import { competenciaAtual, formatarCompetenciaExtenso, formatarData, hojeIso, somarMeses } from '../../lib/datas';
import { textoDeDias } from '../../lib/gatos';
import { usePendentes } from '../../lib/offline/fila';
import { equilibrioDoMes, tarefasPorPessoa } from '../../lib/painelHoje';
import { membrosPorCasal, pessoasIndividuais } from '../../lib/responsaveis';

function textoQuantidade(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

/** Painel inicial: o que precisa de atenção hoje (tarefas por pessoa, gatos, alterações pendentes) e o equilíbrio do mês. */
export function HojePage() {
  const { data: tarefas, isLoading: carregandoTarefas, isError: erroTarefas } = useTarefasManutencao();
  const { data: pessoas } = useDocumentosPessoas();
  const { data: casalMembros } = useCasalMembros();
  const { data: historico } = useHistoricoTarefas();
  const { data: historicoPessoas } = useHistoricoPessoas();
  const proximasGatos = useProximasDatasGatos();
  const pendentes = usePendentes();
  const [mes, setMes] = useState(competenciaAtual);
  const hoje = hojeIso();

  const individuais = useMemo(() => pessoasIndividuais(pessoas ?? []), [pessoas]);
  const membros = useMemo(() => membrosPorCasal(casalMembros ?? []), [casalMembros]);
  const grupos = useMemo(() => tarefasPorPessoa(tarefas ?? [], individuais, membros, hoje), [tarefas, individuais, membros, hoje]);
  const equilibrio = useMemo(() => equilibrioDoMes(historico ?? [], historicoPessoas ?? [], individuais, mes), [historico, historicoPessoas, individuais, mes]);
  const avisosGatos = proximasGatos.filter((p) => p.vencida || p.emBreve);

  if (carregandoTarefas) return <p>Carregando…</p>;
  if (erroTarefas) return <p role="alert">Não foi possível carregar as tarefas.</p>;

  return (
    <div className="hoje">
      <h2 className="hoje-titulo">Hoje, {formatarData(hoje)}</h2>

      {pendentes > 0 && (
        <section className="hoje-cartao" aria-label="Alterações pendentes">
          <h3>Alterações pendentes</h3>
          <p>{textoQuantidade(pendentes, 'alteração feita sem internet espera', 'alterações feitas sem internet esperam')} para ser enviada{pendentes === 1 ? '' : 's'}.</p>
        </section>
      )}

      <section className="hoje-cartao" aria-label="Tarefas">
        <h3>Tarefas</h3>
        {grupos.every((g) => g.atrasadas.length === 0 && g.paraHoje.length === 0) ? (
          <p className="hierarquia-vazio">Nenhuma tarefa atrasada ou para hoje.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.chave} className="hoje-grupo">
              <h4>{g.nome}</h4>
              {g.atrasadas.length === 0 && g.paraHoje.length === 0 ? (
                <p className="hierarquia-vazio">Tudo em dia.</p>
              ) : (
                <ul className="hoje-lista">
                  {g.atrasadas.map((t) => (
                    <li key={t.id} className="hoje-atrasada">
                      {t.nome} <span className="storage-codigo">(atrasada)</span>
                    </li>
                  ))}
                  {g.paraHoje.map((t) => (
                    <li key={t.id}>{t.nome}</li>
                  ))}
                </ul>
              )}
              {g.atrasadas.length > 0 && g.chave !== 'sem' && (
                <Link to={`/apartamento/manutencao?filtro=atrasadas&pessoa=${g.chave}`}>
                  Ver {textoQuantidade(g.atrasadas.length, 'atrasada', 'atrasadas')} de {g.nome}
                </Link>
              )}
            </div>
          ))
        )}
        <p>
          <Link to="/apartamento/manutencao">Abrir Manutenção</Link>
        </p>
      </section>

      <section className="hoje-cartao" aria-label="Gatos">
        <h3>Gatos</h3>
        {avisosGatos.length === 0 ? (
          <p className="hierarquia-vazio">Nenhuma vacina ou vermífugo vencido ou vencendo em 30 dias.</p>
        ) : (
          <ul className="hoje-lista">
            {avisosGatos.map((p) => (
              <li key={`${p.gatoId}-${p.tipo}-${p.titulo}`} className={p.vencida ? 'hoje-atrasada' : undefined}>
                {p.gatoNome}: {p.titulo} em {formatarData(p.data)} ({textoDeDias(p.dias)}){p.vencida ? ' · vencida' : ''}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link to="/documentos/gatos">Abrir Gatos</Link>
        </p>
      </section>

      <section className="hoje-cartao" aria-label="Equilíbrio do mês">
        <h3>Quem fez o quê</h3>
        <div className="calendario-cabecalho-mes">
          <button type="button" onClick={() => setMes((m) => somarMeses(m, -1))} aria-label="Mês anterior">
            ‹
          </button>
          <strong>{formatarCompetenciaExtenso(mes)}</strong>
          <button type="button" onClick={() => setMes((m) => somarMeses(m, 1))} aria-label="Próximo mês">
            ›
          </button>
        </div>
        {equilibrio.execucoes === 0 ? (
          <p className="hierarquia-vazio">Nenhuma tarefa feita neste mês.</p>
        ) : (
          <>
            <table className="hoje-tabela">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Sozinha</th>
                  <th>Junto</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {equilibrio.pessoas.map((p) => (
                  <tr key={p.pessoaId}>
                    <td>{p.nome}</td>
                    <td>{p.sozinha}</td>
                    <td>{p.junto}</td>
                    <td>{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hierarquia-vazio">
              {textoQuantidade(equilibrio.execucoes, 'tarefa feita', 'tarefas feitas')} no mês
              {equilibrio.semRegistro > 0 ? `, ${equilibrio.semRegistro} sem registro de quem fez` : ''}. As feitas juntas contam para cada um.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
