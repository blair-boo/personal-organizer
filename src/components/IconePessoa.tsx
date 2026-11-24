import { IconeUso } from './IconeUso';
import { useIconesUsos } from '../hooks/useIconesUsos';
import { useTemaEfetivo } from '../hooks/useTema';
import { resolverUso } from '../lib/iconesUsos';
import type { PessoaDocumentos } from '../types';

/** Ícone da pessoa (ou do casal) para telas com pouco espaço; sem ícone escolhido aparece a inicial do nome. */
export function IconePessoa({ pessoa, tamanho = 16 }: { pessoa: Pick<PessoaDocumentos, 'id' | 'nome'>; tamanho?: number }) {
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  if (resolverUso(usos, 'pessoa', pessoa.id, tema)) return <IconeUso alvoTipo="pessoa" alvoId={pessoa.id} rotulo={pessoa.nome} tamanhoBase={tamanho} />;
  return (
    <span className="pessoa-inicial" aria-hidden="true">
      {pessoa.nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}
