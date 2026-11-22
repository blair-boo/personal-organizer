import { useState } from 'react';
import { ArquivoLink, BotaoBaixarArquivo } from '../../components/ArquivoLink';
import { BUCKET_STORAGE } from '../../hooks/useStorageCaixas';
import type { AnexoStorage, ItemStorage, ObsStorage, TagItem } from '../../types';

const EXPIRACAO_URL_SEGUNDOS = 60;

/** Tudo que a tela precisa pra desenhar o conteúdo das caixas, já agrupado. */
export interface DadosStorage {
  itensPorCaixa: Map<string, ItemStorage[]>;
  obsPorItem: Map<string, ObsStorage[]>;
  anexosPorItem: Map<string, AnexoStorage[]>;
  tagPorId: Map<string, TagItem>;
}

function ItemConteudo({ item, obs, anexos, tag }: { item: ItemStorage; obs: ObsStorage[]; anexos: AnexoStorage[]; tag?: TagItem }) {
  const [anexosAbertos, setAnexosAbertos] = useState(false);
  return (
    <li className="storage-item">
      <div className="storage-item-linha">
        <span className="storage-item-nome">{item.nome}</span>
        {item.quantidade !== null && <span className="storage-item-quantidade">x{item.quantidade}</span>}
        {tag && <span className="storage-item-tag">{tag.nome}</span>}
        {anexos.length > 0 && (
          <button
            type="button"
            className="arquivo-link"
            aria-expanded={anexosAbertos}
            onClick={() => setAnexosAbertos((aberto) => !aberto)}
            title={anexosAbertos ? `Ocultar anexos de ${item.nome}` : `Mostrar anexos de ${item.nome}`}
            aria-label={anexosAbertos ? `Ocultar anexos de ${item.nome}` : `Mostrar anexos de ${item.nome}`}
          >
            Anexos ({anexos.length})
          </button>
        )}
      </div>
      {obs.length > 0 && (
        <ul className="storage-obs">
          {obs.map((o) => (
            <li key={o.id}>{o.texto}</li>
          ))}
        </ul>
      )}
      {anexosAbertos && (
        <ul className="lista-documentos">
          {anexos.map((anexo) => (
            <li key={anexo.id}>
              <span>{anexo.nome}</span>
              <span className="documentos-anexo-acoes">
                <ArquivoLink bucket={BUCKET_STORAGE} caminho={anexo.arquivo_url} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}>
                  Visualizar
                </ArquivoLink>
                <BotaoBaixarArquivo
                  bucket={BUCKET_STORAGE}
                  caminho={anexo.arquivo_url}
                  nomeArquivo={anexo.nome_arquivo}
                  expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Lista de itens de uma caixa, com quantidade, classificação, observações e anexos (ocultos até clicar). */
export function CaixaConteudo({ caixaId, dados }: { caixaId: string; dados: DadosStorage }) {
  const itens = dados.itensPorCaixa.get(caixaId) ?? [];
  if (itens.length === 0) return <p className="hierarquia-vazio">Nenhum item nesta caixa.</p>;
  return (
    <ul className="storage-itens">
      {itens.map((item) => (
        <ItemConteudo
          key={item.id}
          item={item}
          obs={dados.obsPorItem.get(item.id) ?? []}
          anexos={dados.anexosPorItem.get(item.id) ?? []}
          tag={item.tag_id ? dados.tagPorId.get(item.tag_id) : undefined}
        />
      ))}
    </ul>
  );
}
