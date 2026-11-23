import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { pessoasIndividuais } from '../../lib/responsaveis';
import { useCriarCasalDocumentos } from '../../hooks/useDocumentos';
import type { PessoaDocumentos } from '../../types';

const NOVA = '__nova__';

/** Um casal junta duas pessoas: escolhe as que já existem ou cria uma nova na hora. */
export function CriarCasalModal({ pessoas, onFechar, onCriado }: { pessoas: PessoaDocumentos[]; onFechar: () => void; onCriado: (casal: PessoaDocumentos) => void }) {
  const individuais = pessoasIndividuais(pessoas);
  const { mostrarToast } = useToast();
  const criar = useCriarCasalDocumentos();
  const [escolhas, setEscolhas] = useState<[string, string]>([individuais[0]?.id ?? NOVA, individuais[1]?.id ?? NOVA]);
  const [nomesNovos, setNomesNovos] = useState<[string, string]>(['', '']);
  const [nome, setNome] = useState('');
  const [nomeEditado, setNomeEditado] = useState(false);

  function nomeDaEscolha(i: 0 | 1): string {
    return escolhas[i] === NOVA ? nomesNovos[i].trim() : (individuais.find((p) => p.id === escolhas[i])?.nome ?? '');
  }

  const sugestao = nomeDaEscolha(0) && nomeDaEscolha(1) ? `${nomeDaEscolha(0)} e ${nomeDaEscolha(1)}` : '';
  const nomeFinal = nomeEditado ? nome : sugestao;
  const mesmaPessoa = escolhas[0] !== NOVA && escolhas[0] === escolhas[1];
  const faltaNome = [0, 1].some((i) => escolhas[i] === NOVA && !nomesNovos[i].trim());
  const invalido = !nomeFinal.trim() || mesmaPessoa || faltaNome;

  async function salvar() {
    try {
      const { casal, resultado } = await criar.mutateAsync({
        nome: nomeFinal.trim(),
        pessoaIds: escolhas.filter((e) => e !== NOVA),
        novasPessoas: [0, 1].filter((i) => escolhas[i] === NOVA).map((i) => nomesNovos[i].trim()),
      });
      mostrarToast(resultado === 'enfileirada' ? 'Casal criado com os documentos padrão. Será enviado quando houver internet.' : 'Casal criado com os documentos padrão.');
      onCriado(casal);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function campo(i: 0 | 1) {
    return (
      <div className="documentos-form-fixo">
        <label>
          Pessoa {i + 1}
          <select value={escolhas[i]} onChange={(e) => setEscolhas((atual) => (i === 0 ? [e.target.value, atual[1]] : [atual[0], e.target.value]))}>
            {individuais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
            <option value={NOVA}>+ Nova pessoa…</option>
          </select>
        </label>
        {escolhas[i] === NOVA && (
          <input
            type="text"
            placeholder="Nome da nova pessoa"
            aria-label={`Nome da nova pessoa ${i + 1}`}
            value={nomesNovos[i]}
            onChange={(e) => setNomesNovos((atual) => (i === 0 ? [e.target.value, atual[1]] : [atual[0], e.target.value]))}
          />
        )}
      </div>
    );
  }

  return (
    <ModalBase aberto rotulo="Novo casal" onFechar={onFechar} classe="modal-edicao">
      <h3 className="modal-titulo">Novo casal</h3>
      {campo(0)}
      {campo(1)}
      {mesmaPessoa && <p role="alert">Escolha duas pessoas diferentes.</p>}
      <label>
        Nome do casal
        <input
          type="text"
          value={nomeFinal}
          onChange={(e) => {
            setNome(e.target.value);
            setNomeEditado(true);
          }}
        />
      </label>
      <div className="modal-acoes">
        <button type="button" onClick={salvar} disabled={invalido || criar.isPending} data-autofocus>
          {criar.isPending ? 'Criando…' : 'Criar casal'}
        </button>
        <button type="button" onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </ModalBase>
  );
}
