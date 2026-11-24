import { useState } from 'react';
import { ArquivoLink, BotaoBaixarArquivo } from '../../components/ArquivoLink';
import { BUCKET_STORAGE } from '../../hooks/useStorageCaixas';
import type { AnexoCaixaStorage, AnexoStorage, CaixaStorage, ItemStorage, ObsStorage, TagItem } from '../../types';

const EXPIRACAO_URL_SEGUNDOS = 60;

/** Tudo que a tela precisa pra desenhar o conteúdo das caixas, já agrupado. */
export interface DadosStorage {
  itensPorCaixa: Map<string, ItemStorage[]>;
  obsPorItem: Map<string, ObsStorage[]>;
  anexosPorItem: Map<string, AnexoStorage[]>;
  tagPorId: Map<string, TagItem>;
  /** Anexos da caixa inteira. */
  anexosPorCaixa: Map<string, AnexoCaixaStorage[]>;
  caixaPorId: Map<string, CaixaStorage>;
}

function ItemConteudo({ item, obs, anexos, tag, herdada, destacado }: { item: ItemStorage; obs: ObsStorage[]; anexos: AnexoStorage[]; tag?: TagItem; herdada: boolean; destacado: boolean }) {
  const [anexosAbertos, setAnexosAbertos] = useState(false);
  return (
    <li className={destacado ? 'storage-item storage-item-destaque' : 'storage-item'}>
      <div className="storage-item-linha">
        <span className="storage-item-nome">{item.nome}</span>
        {item.quantidade !== null && <span className="storage-item-quantidade">x{item.quantidade}</span>}
        {tag && (
          <span className={herdada ? 'storage-item-tag storage-item-tag-herdada' : 'storage-item-tag'} title={herdada ? 'Tag herdada da caixa' : undefined}>
            {tag.nome}
          </span>
        )}
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

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Anexos da caixa inteira (separados dos anexos dos itens). */
function AnexosDaCaixa({ anexos }: { anexos: AnexoCaixaStorage[] }) {
  return (
    <div className="storage-anexos-caixa">
      <h4 className="storage-anexos-caixa-titulo">Anexos da caixa</h4>
      <ul className="lista-documentos">
        {anexos.map((anexo) => (
          <li key={anexo.id}>
            <span>{anexo.nome}</span>
            <span className="documentos-anexo-acoes">
              <ArquivoLink bucket={BUCKET_STORAGE} caminho={anexo.arquivo_url} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS}>
                Visualizar
              </ArquivoLink>
              <BotaoBaixarArquivo bucket={BUCKET_STORAGE} caminho={anexo.arquivo_url} nomeArquivo={anexo.nome_arquivo} expiraEmSegundos={EXPIRACAO_URL_SEGUNDOS} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Conteúdo de uma caixa: anexos da caixa inteira e lista de itens, com quantidade, tag (a do item ou, sem ela, a da caixa),
 * observações e anexos (ocultos até clicar). Com busca ativa, os itens que batem ficam em destaque.
 */
export function CaixaConteudo({ caixaId, dados, busca = '' }: { caixaId: string; dados: DadosStorage; busca?: string }) {
  const itens = dados.itensPorCaixa.get(caixaId) ?? [];
  const anexosCaixa = dados.anexosPorCaixa.get(caixaId) ?? [];
  const caixa = dados.caixaPorId.get(caixaId);
  const q = normalizar(busca);
  return (
    <>
      {anexosCaixa.length > 0 && <AnexosDaCaixa anexos={anexosCaixa} />}
      {itens.length === 0 ? (
        <p className="hierarquia-vazio">Nenhum item nesta caixa.</p>
      ) : (
        <ul className="storage-itens">
          {itens.map((item) => {
            const tagId = item.tag_id ?? caixa?.tag_id ?? null;
            return (
              <ItemConteudo
                key={item.id}
                item={item}
                obs={dados.obsPorItem.get(item.id) ?? []}
                anexos={dados.anexosPorItem.get(item.id) ?? []}
                tag={tagId ? dados.tagPorId.get(tagId) : undefined}
                herdada={item.tag_id === null && tagId !== null}
                destacado={q !== '' && normalizar(item.nome).includes(q)}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
