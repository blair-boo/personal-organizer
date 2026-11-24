import { IconeDoUso } from './IconeUso';
import { IconePng } from './IconeSupabase';
import { useIconesUsos } from '../hooks/useIconesUsos';
import { useTemaEfetivo } from '../hooks/useTema';
import { ICONE_CAIXA_PADRAO } from '../lib/iconesFuncoes';
import { resolverUso } from '../lib/iconesUsos';
import type { UsoIcone } from '../types';

interface IconeCaixaProps {
  caixaId: string;
  tamanho?: number;
  /** Mostra este uso em vez do salvo (prévia antes de salvar); null mostra o ícone padrão. */
  uso?: UsoIcone | null;
}

/** Ícone da caixa de Storage: o escolhido para ela ou, sem escolha, o padrão (ilustração colorida da pasta Simples). */
export function IconeCaixa({ caixaId, tamanho = 18, uso: usoForcado }: IconeCaixaProps) {
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  const uso = usoForcado !== undefined ? usoForcado : resolverUso(usos, 'caixa', caixaId, tema);
  return (
    <span className="icone-caixa">
      {uso ? <IconeDoUso uso={uso} tamanhoBase={tamanho} /> : <IconePng arquivo={ICONE_CAIXA_PADRAO} tamanho={tamanho} />}
    </span>
  );
}
