import { useSearchParams } from 'react-router-dom';
import { useEscopoFinancas } from '../hooks/useEscopoFinancas';
import { useFinancasAcessos } from '../hooks/useFinancasAcessos';
import { useNomesUsuarios } from '../hooks/useNomesUsuarios';
import { PARAMETRO_ESCOPO, chaveDoEscopo, pessoasQueLiberaram } from '../lib/financas';

/** Eu | pessoas que liberaram as finanças para mim | Conjunto. O escolhido vai na URL (`?de=`). */
export function SeletorEscopoFinancas() {
  const { escopo, meuId } = useEscopoFinancas();
  const { data: acessos } = useFinancasAcessos();
  const nomeDe = useNomesUsuarios();
  const [params, setParams] = useSearchParams();
  const atual = chaveDoEscopo(escopo);

  const opcoes = [
    { chave: 'eu', rotulo: 'Eu', dica: 'Minhas finanças' },
    ...pessoasQueLiberaram(acessos ?? [], meuId).map(({ usuarioId, nivel }) => ({
      chave: usuarioId,
      rotulo: nomeDe(usuarioId),
      dica: `Finanças de ${nomeDe(usuarioId)} (${nivel === 'editar' ? 'você pode editar' : 'somente leitura'})`,
    })),
    { chave: 'conjunto', rotulo: 'Conjunto', dica: 'Contas conjuntas e despesas divididas' },
  ];

  function escolher(chave: string) {
    const proximos = new URLSearchParams(params);
    if (chave === 'eu') proximos.delete(PARAMETRO_ESCOPO);
    else proximos.set(PARAMETRO_ESCOPO, chave);
    setParams(proximos, { replace: true });
  }

  return (
    <div className="escopo-seletor" role="group" aria-label="Finanças de">
      {opcoes.map((o) => (
        <button
          key={o.chave}
          type="button"
          className={o.chave === atual ? 'active' : undefined}
          aria-pressed={o.chave === atual}
          title={o.dica}
          onClick={() => escolher(o.chave)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
