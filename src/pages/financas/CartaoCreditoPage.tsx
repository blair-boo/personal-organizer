import { useParams } from 'react-router-dom';
import { ExtratoContaView } from './ExtratoContaView';

export function CartaoCreditoPage() {
  const { competencia } = useParams<{ competencia: string }>();
  return <ExtratoContaView competencia={competencia!} tiposConta={['cartao_credito']} />;
}
