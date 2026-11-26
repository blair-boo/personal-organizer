import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistoricoPessoas, useHistoricoTarefas } from '../../hooks/useTarefasHistorico';
import { useTarefasManutencao } from '../../hooks/useTarefasManutencao';
import { useCasalMembros, useDocumentosPendentes, useDocumentosPessoas } from '../../hooks/useDocumentos';
import { IconePng } from '../../components/IconeSupabase';
import { pendenciasApartamento, pendenciasPessoais, ROTULO_PENDENCIA, type ItemPendente } from '../../lib/documentosPendentes';
import { usePermissoes } from '../../hooks/usePermissoes';
import { useProximasDatasGatos } from '../../hooks/useProximasDatasGatos';
import { competenciaAtual, formatarCompetenciaExtenso, formatarData, hojeIso, somarMeses } from '../../lib/datas';
import { textoDeDias } from '../../lib/gatos';
import { usePendentes } from '../../lib/offline/fila';
import { equilibrioDoMes, tarefasPorPessoa } from '../../lib/painelHoje';
import { membrosPorCasal, pessoasIndividuais } from '../../lib/responsaveis';

const ICONE_PENDENCIA = 'Warnings/UI_Img_DataSnake_Enemy_Mark.png';

function LinhaPendente({ item, para }: { item: ItemPendente; para: string }) {
  return (
    <li className={`hoje-pendencia${item.motivo === 'vencido' ? ' hoje-atrasada' : ''}`}>
      <IconePng arquivo={ICONE_PENDENCIA} tamanho={16} />
      <Link to={para}>{item.titulo}</Link>
      <span className="storage-codigo">({ROTULO_PENDENCIA[item.motivo]})</span>
    </li>
  );
}

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
  const { data: documentosPendentes, isLoading: carregandoDocumentos, isError: erroDocumentos } = useDocumentosPendentes();
  const proximasGatos = useProximasDatasGatos();
  const pendentes = usePendentes();
  const { podeVer } = usePermissoes();
  const veTarefas = podeVer('apartamento:tarefas');
  const [mes, setMes] = useState(competenciaAtual);
  const hoje = hojeIso();

  const individuais = useMemo(() => pessoasIndividuais(pessoas ?? []), [pessoas]);
  const membros = useMemo(() => membrosPorCasal(casalMembros ?? []), [casalMembros]);
  const grupos = useMemo(() => tarefasPorPessoa(tarefas ?? [], individuais, membros, hoje), [tarefas, individuais, membros, hoje]);
  const equilibrio = useMemo(() => equilibrioDoMes(historico ?? [], historicoPessoas ?? [], individuais, mes), [historico, historicoPessoas, individuais, mes]);
  const gruposDocumentos = useMemo(() => pendenciasPessoais(documentosPendentes ?? [], pessoas ?? [], hoje), [documentosPendentes, pessoas, hoje]);
  const pendentesApartamento = useMemo(() => pendenciasApartamento(documentosPendentes ?? []), [documentosPendentes]);
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

      {veTarefas && (
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
                  <Link to={`/apartamento/tarefas?filtro=atrasadas&pessoa=${g.chave}`}>
                    Ver {textoQuantidade(g.atrasadas.length, 'atrasada', 'atrasadas')} de {g.nome}
                  </Link>
                )}
              </div>
            ))
          )}
          <p>
            <Link to="/apartamento/tarefas">Abrir Tarefas</Link>
          </p>
        </section>

      )}

      {podeVer('documentos:pessoais') && (
        <section className="hoje-cartao" aria-label="Documentos pessoais pendentes">
          <h3>Documentos pessoais pendentes</h3>
          {carregandoDocumentos ? (
            <p>Carregando…</p>
          ) : erroDocumentos ? (
            <p role="alert">Não foi possível carregar os documentos.</p>
          ) : gruposDocumentos.every((g) => g.itens.length === 0) ? (
            <p className="hierarquia-vazio">Nenhum documento pessoal pendente.</p>
          ) : (
            gruposDocumentos
              .filter((g) => g.itens.length > 0)
              .map((g) => (
                <div key={g.pessoaId} className="hoje-grupo">
                  <h4>{g.nome}</h4>
                  <ul className="hoje-lista hoje-lista-pendencias">
                    {g.itens.map((item) => (
                      <LinhaPendente key={item.id} item={item} para={`/documentos/pessoais?pessoa=${g.pessoaId}&doc=${item.id}`} />
                    ))}
                  </ul>
                </div>
              ))
          )}
          <p>
            <Link to="/documentos/pessoais">Abrir Documentos pessoais</Link>
          </p>
        </section>

      )}

      {podeVer('documentos:apartamento') && (
        <section className="hoje-cartao" aria-label="Documentos do apartamento pendentes">
          <h3>Documentos do apartamento pendentes</h3>
          {carregandoDocumentos ? (
            <p>Carregando…</p>
          ) : erroDocumentos ? (
            <p role="alert">Não foi possível carregar os documentos.</p>
          ) : pendentesApartamento.length === 0 ? (
            <p className="hierarquia-vazio">Nenhum documento do apartamento com campo sem preenchimento.</p>
          ) : (
            <ul className="hoje-lista hoje-lista-pendencias">
              {pendentesApartamento.map((item) => (
                <LinhaPendente key={item.id} item={item} para="/documentos/apartamento" />
              ))}
            </ul>
          )}
          <p>
            <Link to="/documentos/apartamento">Abrir Documentos do apartamento</Link>
          </p>
        </section>

      )}

      {podeVer('documentos:gatos') && (
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

      )}

      {veTarefas && (
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
      )}
    </div>
  );
}
