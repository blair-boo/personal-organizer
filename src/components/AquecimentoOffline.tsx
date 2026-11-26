import { useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useAbasConfig } from '../hooks/useAbasConfig';
import { useCategorias } from '../hooks/useCategorias';
import { useContas } from '../hooks/useContas';
import {
  useDocumentoAnexos,
  useDocumentoCampos,
  useDocumentoLocaisRenovacao,
  useDocumentos,
  useDocumentosPessoas,
  useDocumentosPendentes,
  useProximosVencimentosPessoais,
} from '../hooks/useDocumentos';
import { useIconesUsos } from '../hooks/useIconesUsos';
import { useItemDocumentos } from '../hooks/useItemDocumentos';
import { useTodosItemTags } from '../hooks/useItemTags';
import { useItens } from '../hooks/useItens';
import { useProjetoAnexos } from '../hooks/useProjetoAnexos';
import { useProjetos } from '../hooks/useProjetos';
import { useStorageAnexos, useStorageCaixaAnexos } from '../hooks/useStorageAnexos';
import { useStorageCaixas } from '../hooks/useStorageCaixas';
import { useStorageItens } from '../hooks/useStorageItens';
import { useStorageObs } from '../hooks/useStorageObs';
import { useTagsItens } from '../hooks/useTagsItens';
import { useAdiamentosTarefas, useHistoricoPessoas, useHistoricoTarefas } from '../hooks/useTarefasHistorico';
import { useCasalMembros } from '../hooks/useDocumentos';
import { useFinancasAcessos } from '../hooks/useFinancasAcessos';
import { useGatoConsultas } from '../hooks/useGatoConsultas';
import { useGatoExames } from '../hooks/useGatoExames';
import { useGatoPesos } from '../hooks/useGatoPesos';
import { useGatoVacinas } from '../hooks/useGatoVacinas';
import { useGatoVermifugos } from '../hooks/useGatoVermifugos';
import { useGatos } from '../hooks/useGatos';
import { useLancamentosDoMes } from '../hooks/useLancamentos';
import { useTodasRegras } from '../hooks/useRegrasCategorizacao';
import { useLancamentosParcelados, useLancamentosPeriodo } from '../hooks/useResumoFinanceiro';
import { useTarefasManutencao } from '../hooks/useTarefasManutencao';
import { usePerfis } from '../hooks/useUsuarios';
import { useTodasTarefaClassificacoes } from '../hooks/useTarefaClassificacoes';
import { competenciaAtual, competenciaParaData, somarMeses, ultimoDiaDaCompetencia } from '../lib/datas';
import { chaveFicaOffline } from '../lib/offline/persistencia';
import type { AreaDocumento } from '../types';

/** Quanto tempo sem nenhuma busca em andamento até considerar que acabou. */
const ESPERA_ASSENTAR_MS = 1200;
/** Teto: se algo travar, libera mesmo assim. */
const LIMITE_TOTAL_MS = 90_000;

const AREAS_SEM_PESSOA: AreaDocumento[] = ['apartamento', 'arquivo', 'outros'];

function AquecerItem({ itemId }: { itemId: string }) {
  useItemDocumentos(itemId);
  return null;
}

function AquecerProjeto({ projetoId }: { projetoId: string }) {
  useProjetoAnexos(projetoId);
  return null;
}

function AquecerDocumento({ documentoId }: { documentoId: string }) {
  useDocumentoCampos(documentoId);
  useDocumentoLocaisRenovacao(documentoId);
  useDocumentoAnexos(documentoId);
  return null;
}

/** Extrato de uma conta num mês, igual ao que a tela de Finanças busca. */
function AquecerContaDoMes({ contaId, competencia }: { contaId: string; competencia: string }) {
  useLancamentosDoMes(contaId, competencia);
  return null;
}

function AquecerDocumentos({ area, pessoaId, gatoId }: { area: AreaDocumento; pessoaId?: string; gatoId?: string }) {
  const { data } = useDocumentos(area, pessoaId, gatoId);
  return (
    <>
      {data?.map((d) => (
        <AquecerDocumento key={d.id} documentoId={d.id} />
      ))}
    </>
  );
}

/**
 * Não desenha nada: monta, por pouco tempo, as mesmas consultas que as telas de
 * Apartamento, Documentos, Storage e Finanças usam, pra elas serem buscadas (e guardadas no cache
 * offline) mesmo sem a usuária ter aberto cada tela. Avisa `onTerminou` quando
 * as buscas assentam; quem monta este componente o desmonta em seguida.
 */
export function AquecimentoOffline({ onTerminou }: { onTerminou: () => void }) {
  const itens = useItens();
  const projetos = useProjetos();
  const tarefas = useTarefasManutencao();
  const pessoas = useDocumentosPessoas();
  const gatos = useGatos();
  useGatoVacinas();
  useGatoVermifugos();
  useGatoConsultas();
  useGatoExames();
  useGatoPesos();
  const caixas = useStorageCaixas();
  useStorageItens();
  useStorageObs();
  useStorageAnexos();
  useStorageCaixaAnexos();
  useTagsItens();
  useTodosItemTags();
  useHistoricoTarefas();
  useHistoricoPessoas();
  useAdiamentosTarefas();
  useCasalMembros();
  useTodasTarefaClassificacoes();
  useProximosVencimentosPessoais();
  useDocumentosPendentes();
  useAbasConfig();
  useIconesUsos();

  // Finanças (só leitura): contas, categorias, acessos, regras e os lançamentos do mês atual e do anterior,
  // para qualquer escopo (eu, quem compartilhou, Conjunto). O resumo geral guarda os últimos 6 meses.
  const contas = useContas();
  useCategorias('despesa');
  useCategorias('receita');
  useFinancasAcessos();
  usePerfis();
  useTodasRegras();
  useLancamentosParcelados();
  const mesAtual = competenciaAtual();
  const mesAnterior = somarMeses(mesAtual, -1);
  const mesesDoResumoGeral = somarMeses(mesAtual, -5);
  useLancamentosPeriodo(competenciaParaData(mesAtual), ultimoDiaDaCompetencia(mesAtual));
  useLancamentosPeriodo(competenciaParaData(mesAnterior), ultimoDiaDaCompetencia(mesAnterior));
  useLancamentosPeriodo(competenciaParaData(mesesDoResumoGeral), ultimoDiaDaCompetencia(mesAtual));

  const buscando = useIsFetching({ predicate: (consulta) => chaveFicaOffline(consulta.queryKey) });
  const topoAssentado = [itens, projetos, tarefas, pessoas, caixas, gatos, contas].every((q) => q.status !== 'pending');

  useEffect(() => {
    if (buscando > 0 || !topoAssentado) return;
    const espera = setTimeout(onTerminou, ESPERA_ASSENTAR_MS);
    return () => clearTimeout(espera);
  }, [buscando, topoAssentado, onTerminou]);

  useEffect(() => {
    const limite = setTimeout(onTerminou, LIMITE_TOTAL_MS);
    return () => clearTimeout(limite);
  }, [onTerminou]);

  return (
    <>
      {itens.data?.map((i) => (
        <AquecerItem key={i.id} itemId={i.id} />
      ))}
      {projetos.data?.map((p) => (
        <AquecerProjeto key={p.id} projetoId={p.id} />
      ))}
      {pessoas.data?.map((p) => (
        <AquecerDocumentos key={p.id} area="pessoais" pessoaId={p.id} />
      ))}
      {gatos.data?.map((g) => (
        <AquecerDocumentos key={g.id} area="gatos" gatoId={g.id} />
      ))}
      {contas.data
        ?.filter((c) => c.status === 'ativo')
        .flatMap((c) => [mesAtual, mesAnterior].map((competencia) => <AquecerContaDoMes key={`${c.id}-${competencia}`} contaId={c.id} competencia={competencia} />))}
      {AREAS_SEM_PESSOA.map((area) => (
        <AquecerDocumentos key={area} area={area} />
      ))}
    </>
  );
}
