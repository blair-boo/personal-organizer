import { useRef, useState, type ChangeEvent } from 'react';
import { ModalBase } from './ModalBase';
import { useToast } from './Toast';
import { IconeDoUso, IconeFuncao } from './IconeUso';
import { IconeSupabase } from './IconeSupabase';
import { useAdicionarIcones, useIconesGaleria } from '../hooks/useIcones';
import { useCoresUsuario } from '../hooks/useCoresUsuario';
import { APP_CORES } from '../lib/coresApp';
import { mensagemDeErro } from '../lib/erros';
import { caminhoIcone } from '../lib/storage';
import type { AlvoIcone, CorOrigemIcone, TemaIcone, UsoIcone } from '../types';

const PASSO_TAMANHO = 4;

interface ModalIconeProps {
  aberto: boolean;
  /** Nome do que recebe o ícone (título, aba ou função), mostrado no cabeçalho. */
  rotuloAlvo: string;
  alvoTipo: AlvoIcone;
  alvoId: string;
  /** Uso atual do alvo (null = sem ícone). */
  inicial: UsoIcone | null;
  /** Tamanho padrão do ícone nesse lugar, em px. */
  tamanhoBase: number;
  /** Mostra "Remover ícone" (nas funções não: elas sempre têm um ícone). */
  permiteRemover: boolean;
  onConfirmar: (uso: UsoIcone) => void;
  onRemover?: () => void;
  onFechar: () => void;
}

/**
 * Modal único para escolher e configurar um ícone: entre os existentes ou novo,
 * tamanho, máscara de cor (padrão do lugar, cores do app ou minhas cores) e tema
 * (claro, escuro ou ambos), com prévia nos dois temas.
 */
export function ModalIcone(props: ModalIconeProps) {
  if (!props.aberto) return null;
  // O conteúdo remonta a cada abertura, então o rascunho sempre parte do uso atual.
  return <ModalIconeConteudo {...props} />;
}

function ModalIconeConteudo({ rotuloAlvo, alvoTipo, alvoId, inicial, tamanhoBase, permiteRemover, onConfirmar, onRemover, onFechar }: ModalIconeProps) {
  const { mostrarToast } = useToast();
  const raiz = useIconesGaleria('');
  const originais = useIconesGaleria('PNG');
  const { cores: minhasCores } = useCoresUsuario();
  const [pastaDestino, setPastaDestino] = useState<'' | 'PNG'>('');
  const adicionar = useAdicionarIcones(pastaDestino);
  const inputRef = useRef<HTMLInputElement>(null);

  const [origem, setOrigem] = useState<'existentes' | 'novo'>('existentes');
  const [escolhido, setEscolhido] = useState<{ pasta: string; arquivo: string } | null>(
    inicial ? { pasta: inicial.icone_pasta, arquivo: inicial.icone_arquivo } : null
  );
  const [delta, setDelta] = useState(inicial?.tamanho_delta ?? 0);
  const [mascara, setMascara] = useState(inicial?.mascara ?? true);
  const [corOrigem, setCorOrigem] = useState<CorOrigemIcone>(inicial?.cor_origem ?? 'padrao');
  const [corValor, setCorValor] = useState<string | null>(inicial?.cor_valor ?? null);
  const [tema, setTema] = useState<TemaIcone>(inicial?.tema ?? 'ambos');

  const usoRascunho: UsoIcone | null = escolhido
    ? {
        alvo_tipo: alvoTipo,
        alvo_id: alvoId,
        icone_pasta: escolhido.pasta,
        icone_arquivo: escolhido.arquivo,
        tamanho_delta: delta,
        mascara,
        cor_origem: mascara ? corOrigem : 'padrao',
        cor_valor: mascara && corOrigem !== 'padrao' ? corValor : null,
        tema,
      }
    : null;

  function escolherCor(origemNova: CorOrigemIcone, valor: string | null) {
    setCorOrigem(origemNova);
    setCorValor(valor);
  }

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      await adicionar.mutateAsync([arquivo]);
      setEscolhido({ pasta: pastaDestino, arquivo: arquivo.name });
      setOrigem('existentes');
      mostrarToast('Ícone adicionado.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function aplicar() {
    if (!usoRascunho) return;
    onConfirmar(usoRascunho);
  }

  const carregando = raiz.isLoading || originais.isLoading;
  const erro = raiz.isError || originais.isError ? mensagemDeErro(raiz.error ?? originais.error) : null;
  const rotuloTamanho = delta === 0 ? 'padrão' : delta > 0 ? `+${delta}px` : `${delta}px`;

  return (
    <ModalBase aberto rotulo={`Ícone de ${rotuloAlvo}`} onFechar={onFechar} classe="modal-icone">
      <h2 className="modal-titulo">Ícone de {rotuloAlvo}</h2>

      <div className="modal-icone-secao">
        <div className="modal-icone-abas" role="tablist" aria-label="Origem do ícone">
          <button type="button" role="tab" aria-selected={origem === 'existentes'} className={origem === 'existentes' ? 'ativa' : ''} onClick={() => setOrigem('existentes')}>
            Existentes
          </button>
          <button type="button" role="tab" aria-selected={origem === 'novo'} className={origem === 'novo' ? 'ativa' : ''} onClick={() => setOrigem('novo')}>
            Adicionar novo
          </button>
        </div>

        {origem === 'existentes' ? (
          <>
            {carregando && <p className="hierarquia-vazio">Carregando…</p>}
            {erro && <p className="testes-erro">Não foi possível carregar os ícones: {erro}</p>}
            {!carregando && !erro && (
              <div className="modal-icone-grade" role="listbox" aria-label="Ícones existentes">
                {[
                  { pasta: '', lista: raiz.data ?? [] },
                  { pasta: 'PNG', lista: originais.data ?? [] },
                ].flatMap(({ pasta, lista }) =>
                  lista.map((icone) => {
                    const selecionado = escolhido?.pasta === pasta && escolhido.arquivo === icone.nome;
                    return (
                      <button
                        key={`${pasta}/${icone.nome}`}
                        type="button"
                        role="option"
                        aria-selected={selecionado}
                        className={`modal-icone-opcao${selecionado ? ' selecionado' : ''}`}
                        onClick={() => setEscolhido({ pasta, arquivo: icone.nome })}
                        title={icone.nome}
                        aria-label={icone.nome}
                      >
                        {pasta === '' ? (
                          <IconeSupabase arquivo={caminhoIcone(pasta, icone.nome)} tamanho={24} />
                        ) : (
                          <img className="icone-png" src={icone.url} alt="" width={24} height={24} loading="lazy" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : (
          <div className="modal-icone-novo">
            <fieldset className="modal-icone-fieldset">
              <legend>Salvar em</legend>
              <label className="modal-icone-radio">
                <input type="radio" name="pasta-destino" checked={pastaDestino === ''} onChange={() => setPastaDestino('')} />
                Ícones (Com máscara)
              </label>
              <label className="modal-icone-radio">
                <input type="radio" name="pasta-destino" checked={pastaDestino === 'PNG'} onChange={() => setPastaDestino('PNG')} />
                Ícones (Originais)
              </label>
            </fieldset>
            <input ref={inputRef} type="file" accept="image/*" onChange={aoEscolherArquivo} hidden />
            <button type="button" className="btn-icone icone-uso-botao" onClick={() => inputRef.current?.click()} disabled={adicionar.isPending} title="Selecionar arquivo de imagem" aria-label="Selecionar arquivo de imagem">
              <IconeFuncao funcao="selecionar" />
            </button>
          </div>
        )}
      </div>

      <div className="modal-icone-secao">
        <h3>Tamanho: {rotuloTamanho}</h3>
        <div className="modal-icone-linha">
          <button type="button" onClick={() => setDelta((d) => d - PASSO_TAMANHO)} disabled={tamanhoBase + delta - PASSO_TAMANHO < 8}>
            Menor
          </button>
          <button type="button" onClick={() => setDelta(0)} disabled={delta === 0}>
            Padrão
          </button>
          <button type="button" onClick={() => setDelta((d) => d + PASSO_TAMANHO)} disabled={delta >= 5 * PASSO_TAMANHO}>
            Maior
          </button>
        </div>
      </div>

      <div className="modal-icone-secao">
        <label className="modal-icone-radio">
          <input type="checkbox" checked={mascara} onChange={(e) => setMascara(e.target.checked)} />
          Usar máscara de cor
        </label>
        {mascara && (
          <>
            <div className="modal-icone-linha">
              <button type="button" className={corOrigem === 'padrao' ? 'ativa' : ''} onClick={() => escolherCor('padrao', null)} aria-pressed={corOrigem === 'padrao'}>
                Cor padrão
              </button>
            </div>
            <h3>Cores do app</h3>
            <div className="modal-icone-cores">
              {APP_CORES.map((c) => (
                <button
                  key={c.cssVar}
                  type="button"
                  className={`modal-icone-cor${corOrigem === 'app' && corValor === c.cssVar ? ' selecionado' : ''}`}
                  style={{ background: `var(${c.cssVar})` }}
                  onClick={() => escolherCor('app', c.cssVar)}
                  title={c.label}
                  aria-label={`Cor do app ${c.label}`}
                />
              ))}
            </div>
            <h3>Minhas cores</h3>
            {minhasCores.length === 0 ? (
              <p className="hierarquia-vazio">Nenhuma cor salva ainda.</p>
            ) : (
              <div className="modal-icone-cores">
                {minhasCores.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`modal-icone-cor${corOrigem === 'minha' && corValor === c.hex ? ' selecionado' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => escolherCor('minha', c.hex)}
                    title={c.label || c.hex}
                    aria-label={`Minha cor ${c.label || c.hex}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="modal-icone-secao">
        <h3>Tema</h3>
        <div className="modal-icone-linha" role="group" aria-label="Tema em que o ícone vale">
          {([['claro', 'Claro'], ['escuro', 'Escuro'], ['ambos', 'Os dois']] as const).map(([valor, texto]) => (
            <button key={valor} type="button" className={tema === valor ? 'ativa' : ''} aria-pressed={tema === valor} onClick={() => setTema(valor)}>
              {texto}
            </button>
          ))}
        </div>
        <div className="modal-icone-previas">
          {(['claro', 'escuro'] as const).map((t) => (
            <figure key={t} className={`modal-icone-previa${tema === t || tema === 'ambos' ? ' vale' : ''}`} data-tema-previa={t === 'claro' ? 'light' : 'dark'}>
              <div className="modal-icone-previa-caixa">
                {usoRascunho ? <IconeDoUso uso={usoRascunho} tamanhoBase={Math.max(tamanhoBase, 24)} /> : <span className="hierarquia-vazio">Sem ícone</span>}
              </div>
              <figcaption>{t === 'claro' ? 'Claro' : 'Escuro'}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="modal-acoes modal-icone-acoes">
        {permiteRemover && inicial && onRemover && (
          <button type="button" className="btn-icone btn-icone-perigo icone-uso-botao" onClick={onRemover} title={`Remover ícone de ${rotuloAlvo}`} aria-label={`Remover ícone de ${rotuloAlvo}`}>
            <IconeFuncao funcao="excluir" />
          </button>
        )}
        <button type="button" className="btn-icone icone-uso-botao" onClick={aplicar} disabled={!usoRascunho} title="Aplicar ícone" aria-label="Aplicar ícone">
          <IconeFuncao funcao="salvar" />
        </button>
      </div>
    </ModalBase>
  );
}
