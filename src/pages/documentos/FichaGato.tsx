import { ArquivoLink, BotaoBaixarArquivo } from '../../components/ArquivoLink';
import { useToast } from '../../components/Toast';
import { formatarData, hojeIso } from '../../lib/datas';
import { mensagemDeErro } from '../../lib/erros';
import { formatarKg, formatarVariacaoKg, idadeDoGato, textoDeDias, diasEntre, variacoesDePeso } from '../../lib/gatos';
import { useAtualizarGato } from '../../hooks/useGatos';
import { useAtualizarGatoConsulta, useExcluirGatoConsulta, useGatoConsultas, useIncluirGatoConsulta } from '../../hooks/useGatoConsultas';
import { BUCKET_GATOS, useAtualizarGatoExame, useExcluirGatoExame, useGatoExames, useIncluirGatoExame } from '../../hooks/useGatoExames';
import { useAtualizarGatoPeso, useExcluirGatoPeso, useGatoPesos, useIncluirGatoPeso } from '../../hooks/useGatoPesos';
import { useAtualizarGatoVacina, useExcluirGatoVacina, useGatoVacinas, useIncluirGatoVacina } from '../../hooks/useGatoVacinas';
import { useAtualizarGatoVermifugo, useExcluirGatoVermifugo, useGatoVermifugos, useIncluirGatoVermifugo } from '../../hooks/useGatoVermifugos';
import type { Gato } from '../../types';
import { DocumentosAreaPage } from './DocumentosAreaPage';
import { SecaoRegistros, type CampoRegistro } from './SecaoRegistros';

const EXPIRACAO_URL_SEGUNDOS = 60;

const CAMPOS_VACINA: CampoRegistro[] = [
  { chave: 'vacina', rotulo: 'Vacina', tipo: 'texto', obrigatorio: true },
  { chave: 'data', rotulo: 'Data da aplicação', tipo: 'data', obrigatorio: true },
  { chave: 'proxima_data', rotulo: 'Próxima dose (opcional)', tipo: 'data' },
];
const CAMPOS_VERMIFUGO: CampoRegistro[] = [
  { chave: 'produto', rotulo: 'Qual vermífugo', tipo: 'texto', obrigatorio: true },
  { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
  { chave: 'proxima_data', rotulo: 'Próximo (opcional)', tipo: 'data' },
];
const CAMPOS_CONSULTA: CampoRegistro[] = [
  { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
  { chave: 'veterinario', rotulo: 'Veterinário', tipo: 'texto' },
  { chave: 'observacao', rotulo: 'Observação', tipo: 'textoLongo' },
];
const CAMPOS_EXAME: CampoRegistro[] = [
  { chave: 'nome', rotulo: 'Nome do exame', tipo: 'texto', obrigatorio: true },
  { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
];
const CAMPOS_PESO: CampoRegistro[] = [
  { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
  { chave: 'peso_kg', rotulo: 'Peso (kg)', tipo: 'kg', obrigatorio: true },
];

function vazioParaNulo(valor: string | undefined): string | null {
  const v = (valor ?? '').trim();
  return v === '' ? null : v;
}

/** Peso digitado com vírgula ou ponto. */
function lerKg(texto: string | undefined): number {
  const n = Number((texto ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) throw new Error('Digite um peso maior que zero, em kg.');
  return Math.round(n * 100) / 100;
}

function TextoProxima({ data, hoje }: { data: string | null; hoje: string }) {
  if (!data) return null;
  const dias = diasEntre(hoje, data);
  return (
    <span className={dias < 0 ? 'gatos-proxima-vencida' : undefined}>
      Próxima: {formatarData(data)} ({textoDeDias(dias)})
    </span>
  );
}

/** Ficha de um gato: nascimento e idade, e as seções de vacinas, vermífugo, consultas, exames, peso e documentos. */
export function FichaGato({ gato }: { gato: Gato }) {
  const { mostrarToast } = useToast();
  const hoje = hojeIso();
  const atualizarGato = useAtualizarGato();

  const vacinas = (useGatoVacinas().data ?? []).filter((r) => r.gato_id === gato.id);
  const vermifugos = (useGatoVermifugos().data ?? []).filter((r) => r.gato_id === gato.id);
  const consultas = (useGatoConsultas().data ?? []).filter((r) => r.gato_id === gato.id);
  const exames = (useGatoExames().data ?? []).filter((r) => r.gato_id === gato.id);
  const pesos = (useGatoPesos().data ?? []).filter((r) => r.gato_id === gato.id);
  const variacoes = variacoesDePeso(pesos);

  const incluirVacina = useIncluirGatoVacina();
  const atualizarVacina = useAtualizarGatoVacina();
  const excluirVacina = useExcluirGatoVacina();
  const incluirVermifugo = useIncluirGatoVermifugo();
  const atualizarVermifugo = useAtualizarGatoVermifugo();
  const excluirVermifugo = useExcluirGatoVermifugo();
  const incluirConsulta = useIncluirGatoConsulta();
  const atualizarConsulta = useAtualizarGatoConsulta();
  const excluirConsulta = useExcluirGatoConsulta();
  const incluirExame = useIncluirGatoExame();
  const atualizarExame = useAtualizarGatoExame();
  const excluirExame = useExcluirGatoExame();
  const incluirPeso = useIncluirGatoPeso();
  const atualizarPeso = useAtualizarGatoPeso();
  const excluirPeso = useExcluirGatoPeso();

  const idade = idadeDoGato(gato.nascimento, hoje);

  async function trocarNascimento(valor: string) {
    try {
      await atualizarGato.mutateAsync({ id: gato.id, dados: { nascimento: valor === '' ? null : valor } });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="gatos-ficha">
      <div className="documentos-prazo-linha gatos-nascimento">
        <label>
          Data de nascimento
          <input type="date" value={gato.nascimento ?? ''} max={hoje} onChange={(e) => void trocarNascimento(e.target.value)} />
        </label>
        <p className="gatos-idade" aria-live="polite">
          {idade ? `Idade: ${idade}` : 'Informe o nascimento para ver a idade.'}
        </p>
      </div>

      <SecaoRegistros
        titulo="Vacinas"
        item="vacina"
        textoVazio="Nenhuma vacina registrada."
        registros={vacinas}
        campos={CAMPOS_VACINA}
        valoresDe={(r) => ({ vacina: r.vacina, data: r.data, proxima_data: r.proxima_data ?? '' })}
        linha={(r) => (
          <>
            <strong>{r.vacina}</strong> em {formatarData(r.data)}
            <br />
            <TextoProxima data={r.proxima_data} hoje={hoje} />
          </>
        )}
        onSalvar={async (v, registro) => {
          const dados = { gato_id: gato.id, vacina: v.vacina.trim(), data: v.data, proxima_data: vazioParaNulo(v.proxima_data) };
          if (registro) await atualizarVacina.mutateAsync({ id: registro.id, dados });
          else await incluirVacina.mutateAsync(dados);
          mostrarToast('Vacina salva.');
        }}
        onExcluir={(r) => excluirVacina.mutateAsync(r.id)}
      />

      <SecaoRegistros
        titulo="Vermífugo"
        item="vermífugo"
        textoVazio="Nenhum vermífugo registrado."
        registros={vermifugos}
        campos={CAMPOS_VERMIFUGO}
        valoresDe={(r) => ({ produto: r.produto, data: r.data, proxima_data: r.proxima_data ?? '' })}
        linha={(r) => (
          <>
            <strong>{r.produto}</strong> em {formatarData(r.data)}
            <br />
            <TextoProxima data={r.proxima_data} hoje={hoje} />
          </>
        )}
        onSalvar={async (v, registro) => {
          const dados = { gato_id: gato.id, produto: v.produto.trim(), data: v.data, proxima_data: vazioParaNulo(v.proxima_data) };
          if (registro) await atualizarVermifugo.mutateAsync({ id: registro.id, dados });
          else await incluirVermifugo.mutateAsync(dados);
          mostrarToast('Vermífugo salvo.');
        }}
        onExcluir={(r) => excluirVermifugo.mutateAsync(r.id)}
      />

      <SecaoRegistros
        titulo="Consultas"
        item="consulta"
        textoVazio="Nenhuma consulta registrada."
        registros={consultas}
        campos={CAMPOS_CONSULTA}
        valoresDe={(r) => ({ data: r.data, veterinario: r.veterinario ?? '', observacao: r.observacao ?? '' })}
        linha={(r) => (
          <>
            <strong>{formatarData(r.data)}</strong>
            {r.veterinario ? ` · ${r.veterinario}` : ''}
            {r.observacao && <p className="gatos-observacao">{r.observacao}</p>}
          </>
        )}
        onSalvar={async (v, registro) => {
          const dados = { gato_id: gato.id, data: v.data, veterinario: vazioParaNulo(v.veterinario), observacao: vazioParaNulo(v.observacao) };
          if (registro) await atualizarConsulta.mutateAsync({ id: registro.id, dados });
          else await incluirConsulta.mutateAsync(dados);
          mostrarToast('Consulta salva.');
        }}
        onExcluir={(r) => excluirConsulta.mutateAsync(r.id)}
      />

      <SecaoRegistros
        titulo="Exames"
        item="exame"
        textoVazio="Nenhum exame registrado."
        pedeArquivo
        registros={exames}
        campos={CAMPOS_EXAME}
        valoresDe={(r) => ({ nome: r.nome, data: r.data })}
        linha={(r) => (
          <>
            <strong>{r.nome}</strong> em {formatarData(r.data)}{' '}
            <span className="documentos-anexo-acoes">
              <ArquivoLink bucket={BUCKET_GATOS} caminho={r.arquivo_url} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}>
                Visualizar
              </ArquivoLink>
              <BotaoBaixarArquivo bucket={BUCKET_GATOS} caminho={r.arquivo_url} nomeArquivo={r.nome_arquivo} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS} />
            </span>
          </>
        )}
        onSalvar={async (v, registro, arquivo) => {
          if (registro) {
            await atualizarExame.mutateAsync({ id: registro.id, dados: { nome: v.nome.trim(), data: v.data } });
            if (arquivo) throw new Error('Para trocar o arquivo, exclua o exame e inclua de novo.');
          } else {
            if (!arquivo) throw new Error('Escolha o arquivo do exame.');
            await incluirExame.mutateAsync({ gatoId: gato.id, data: v.data, nome: v.nome.trim(), arquivo });
          }
          mostrarToast('Exame salvo.');
        }}
        onExcluir={(r) => excluirExame.mutateAsync(r)}
      />

      <SecaoRegistros
        titulo="Peso"
        item="pesagem"
        textoVazio="Nenhuma pesagem registrada."
        registros={pesos}
        campos={CAMPOS_PESO}
        valoresDe={(r) => ({ data: r.data, peso_kg: String(r.peso_kg).replace('.', ',') })}
        linha={(r) => {
          const variacao = variacoes.get(r.id);
          return (
            <>
              <strong>{formatarKg(Number(r.peso_kg))}</strong> em {formatarData(r.data)}
              {variacao !== undefined && <span className="storage-codigo"> ({formatarVariacaoKg(variacao)})</span>}
            </>
          );
        }}
        onSalvar={async (v, registro) => {
          const dados = { gato_id: gato.id, data: v.data, peso_kg: lerKg(v.peso_kg) };
          if (registro) await atualizarPeso.mutateAsync({ id: registro.id, dados });
          else await incluirPeso.mutateAsync(dados);
          mostrarToast('Pesagem salva.');
        }}
        onExcluir={(r) => excluirPeso.mutateAsync(r.id)}
      />

      <details className="gatos-secao">
        <summary>Documentos</summary>
        <DocumentosAreaPage area="gatos" gatoId={gato.id} />
      </details>
    </div>
  );
}
