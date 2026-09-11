import { construirOpcoesHierarquicas } from '../lib/hierarquia';
import { useCategorias } from '../hooks/useCategorias';
import type { TipoLancamento } from '../types';

export function CategoriaSelect({
  tipoLancamento,
  value,
  onChange,
}: {
  tipoLancamento: TipoLancamento;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const tipoCategoria = tipoLancamento === 'entrada' ? 'receita' : 'despesa';
  const { data: categorias } = useCategorias(tipoCategoria);
  const opcoes = construirOpcoesHierarquicas(categorias ?? []);

  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Sem categoria</option>
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
