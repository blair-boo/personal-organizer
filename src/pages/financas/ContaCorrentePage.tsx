import { useParams } from 'react-router-dom';
import { ExtratoContaView } from './ExtratoContaView';

export function ContaCorrentePage() {
  const { competencia } = useParams<{ competencia: string }>();
  return <ExtratoContaView competencia={competencia!} tiposConta={['conta_corrente', 'conta_poupanca', 'conta_investimento']} />;
}
