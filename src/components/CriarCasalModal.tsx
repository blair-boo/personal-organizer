import { useState } from 'react';
import { BotaoSalvarModal, ModalBase } from './ModalBase';
import { useToast } from './Toast';
import { mensagemDeErro } from '../lib/erros';
import { pessoasIndividuais } from '../lib/responsaveis';
import { useAtualizarCasalDocumentos, useCriarCasalDocumentos } from '../hooks/useDocumentos';
import type { PessoaDocumentos } from '../types';

const NOVA = '__nova__';

interface CasalExistente {
  casal: PessoaDocumentos;
  /** Ids das duas pessoas do casal hoje. */
  membroIds: string[];
}

interface CriarCasalModalProps {
  pessoas: PessoaDocumentos[];
  onFechar: () => void;
  /** Chamado depois de criar ou de salvar o casal. */
  onSalvo: (casal: PessoaDocumentos) => void;
  /** Quando informado, o formulário edita este casal (nome e membros) em vez de criar um novo. */
  casalExistente?: CasalExistente;
}

/**
 * Um casal junta duas pessoas: escolhe as que já existem ou cria uma nova na hora.
 * O mesmo formulário cria o casal (Documentos > Pessoais e Settings > Casais) e edita um existente (Settings > Casais).
 */
export function CriarCasalModal({ pessoas, onFechar, onSalvo, casalExistente }: CriarCasalModalProps) {
  const individuais = pessoasIndividuais(pessoas);
  const { mostrarToast } = useToast();
  const criar = useCriarCasalDocumentos();
  const atualizar = useAtualizarCasalDocumentos();
  const editando = !!casalExistente;
  const membrosAtuais = casalExistente?.membroIds ?? [];
  const [escolhas, setEscolhas] = useState<[string, string]>([membrosAtuais[0] ?? individuais[0]?.id ?? NOVA, membrosAtuais[1] ?? individuais[1]?.id ?? NOVA]);
  const [nomesNovos, setNomesNovos] = useState<[string, string]>(['', '']);
  const [nome, setNome] = useState(casalExistente?.casal.nome ?? '');
  const [nomeEditado, setNomeEditado] = useState(editando);

  function nomeDaEscolha(i: 0 | 1): string {
    return escolhas[i] === NOVA ? nomesNovos[i].trim() : (individuais.find((p) => p.id === escolhas[i])?.nome ?? '');
  }

  const sugestao = nomeDaEscolha(0) && nomeDaEscolha(1) ? `${nomeDaEscolha(0)} e ${nomeDaEscolha(1)}` : '';
  const nomeFinal = nomeEditado ? nome : sugestao;
  const mesmaPessoa = escolhas[0] !== NOVA && escolhas[0] === escolhas[1];
  const faltaNome = [0, 1].some((i) => escolhas[i] === NOVA && !nomesNovos[i].trim());
  const mesmosMembros = editando && escolhas.every((e) => membrosAtuais.includes(e)) && nomeFinal.trim() === casalExistente.casal.nome;
  const invalido = !nomeFinal.trim() || mesmaPessoa || faltaNome || mesmosMembros;
  const novasPessoas = [0, 1].filter((i) => escolhas[i] === NOVA).map((i) => nomesNovos[i].trim());
  const pessoaIds = escolhas.filter((e) => e !== NOVA);

  async function salvar() {
    try {
      if (casalExistente) {
        await atualizar.mutateAsync({ casalId: casalExistente.casal.id, nome: nomeFinal.trim(), pessoaIds, novasPessoas });
        mostrarToast('Casal salvo.');
        onSalvo({ ...casalExistente.casal, nome: nomeFinal.trim() });
        return;
      }
      const { casal, resultado } = await criar.mutateAsync({ nome: nomeFinal.trim(), pessoaIds, novasPessoas });
      mostrarToast(resultado === 'enfileirada' ? 'Casal criado com os documentos padrão. Será enviado quando houver internet.' : 'Casal criado com os documentos padrão.');
      onSalvo(casal);
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

  const titulo = editando ? 'Editar casal' : 'Novo casal';
  return (
    <ModalBase
      aberto
      rotulo={titulo}
      onFechar={onFechar}
      classe="modal-edicao"
      titulo={titulo}
      rodape={<BotaoSalvarModal onClick={salvar} disabled={invalido} salvando={criar.isPending || atualizar.isPending} rotulo={editando ? 'Salvar casal' : 'Criar casal'} />}
    >
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
      {editando && <p className="conta-detalhe">Os documentos do casal continuam os mesmos, mesmo trocando as pessoas.</p>}
    </ModalBase>
  );
}
