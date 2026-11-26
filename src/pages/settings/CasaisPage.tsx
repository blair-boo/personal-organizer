import { useState } from 'react';
import { CriarCasalModal } from '../../components/CriarCasalModal';
import { useDialogos } from '../../components/Dialogo';
import { IconePessoa } from '../../components/IconePessoa';
import { IconeFuncao } from '../../components/IconeUso';
import { ModalIcone } from '../../components/ModalIcone';
import { useToast } from '../../components/Toast';
import { useCasalMembros, useDocumentosPessoas, useExcluirPessoaDocumentos } from '../../hooks/useDocumentos';
import { useIconesUsos, useRemoverUsoIcone, useSalvarUsoIcone } from '../../hooks/useIconesUsos';
import { useTemaEfetivo } from '../../hooks/useTema';
import { useEhAdmin, usePerfis } from '../../hooks/useUsuarios';
import { mensagemDeErro } from '../../lib/erros';
import { resolverUso } from '../../lib/iconesUsos';
import { casais, membrosPorCasal } from '../../lib/responsaveis';
import type { Perfil, PessoaDocumentos, UsoIcone } from '../../types';

/** Texto do login de uma pessoa: o e-mail, "convite pendente" se ainda não aceitou, ou "sem login". */
function textoDoLogin(pessoa: PessoaDocumentos, perfis: Perfil[]): string {
  if (!pessoa.usuario_id) return 'sem login';
  const perfil = perfis.find((p) => p.usuario_id === pessoa.usuario_id);
  if (!perfil) return 'sem login';
  return perfil.confirmado ? perfil.email : `${perfil.email} (convite pendente)`;
}

function CasalLinha({ casal, membros, perfis, souAdmin, onEditar }: { casal: PessoaDocumentos; membros: PessoaDocumentos[]; perfis: Perfil[]; souAdmin: boolean; onEditar: () => void }) {
  const { mostrarToast } = useToast();
  const { confirmar } = useDialogos();
  const { data: usosIcones = [] } = useIconesUsos();
  const temaEfetivo = useTemaEfetivo();
  const salvarUso = useSalvarUsoIcone();
  const removerUso = useRemoverUsoIcone();
  const excluir = useExcluirPessoaDocumentos();
  const [escolhendoIcone, setEscolhendoIcone] = useState(false);

  async function excluirCasal() {
    const ok = await confirmar({
      titulo: `Excluir ${casal.nome}?`,
      mensagem: 'Isso apaga também todos os documentos e anexos do casal. As duas pessoas continuam cadastradas. Essa ação não pode ser desfeita.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(casal.id);
      mostrarToast(`${casal.nome} excluído.`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function aplicarIcone(uso: UsoIcone) {
    try {
      await salvarUso.mutateAsync(uso);
      mostrarToast(`Ícone de ${casal.nome} salvo.`);
      setEscolhendoIcone(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function removerIcone() {
    const ok = await confirmar({
      titulo: 'Remover ícone?',
      mensagem: `O ícone sai de "${casal.nome}". O arquivo continua disponível na lista de ícones.`,
      confirmarRotulo: 'Remover',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await removerUso.mutateAsync({ alvoTipo: 'pessoa', alvoId: casal.id });
      mostrarToast(`Ícone de ${casal.nome} removido.`);
      setEscolhendoIcone(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <li className="usuarios-linha">
      <button
        type="button"
        className="btn-icone"
        onClick={() => setEscolhendoIcone(true)}
        disabled={!souAdmin}
        title={souAdmin ? `Trocar ícone de ${casal.nome}` : `Ícone de ${casal.nome}`}
        aria-label={souAdmin ? `Trocar ícone de ${casal.nome}` : `Ícone de ${casal.nome}`}
      >
        <IconePessoa pessoa={casal} tamanho={24} />
      </button>

      <div className="usuarios-identidade">
        <span className="usuarios-nome">{casal.nome}</span>
        {membros.length === 0 ? (
          <span className="conta-detalhe">Sem pessoas ligadas.</span>
        ) : (
          <span className="casais-membros">
            {membros.map((m) => (
              <span key={m.id}>
                {m.nome} <span className="conta-detalhe">{textoDoLogin(m, perfis)}</span>
              </span>
            ))}
          </span>
        )}
      </div>

      {souAdmin && (
        <div className="usuarios-acoes">
          <button type="button" className="btn-icone" onClick={onEditar} title={`Editar ${casal.nome}`} aria-label={`Editar ${casal.nome}`}>
            <IconeFuncao funcao="editar" />
          </button>
          <button type="button" className="btn-icone btn-icone-perigo" onClick={() => void excluirCasal()} disabled={excluir.isPending} title={`Excluir ${casal.nome}`} aria-label={`Excluir ${casal.nome}`}>
            <IconeFuncao funcao="excluir" />
          </button>
        </div>
      )}

      {escolhendoIcone && (
        <ModalIcone
          aberto
          rotuloAlvo={casal.nome}
          alvoTipo="pessoa"
          alvoId={casal.id}
          inicial={resolverUso(usosIcones, 'pessoa', casal.id, temaEfetivo)}
          tamanhoBase={18}
          permiteRemover
          onConfirmar={(uso: UsoIcone) => void aplicarIcone(uso)}
          onRemover={() => void removerIcone()}
          onFechar={() => setEscolhendoIcone(false)}
        />
      )}
    </li>
  );
}

/**
 * Settings > Casais: cada casal com as duas pessoas e o login de cada uma. Todos veem; só admin cria, troca
 * as pessoas, renomeia, escolhe o ícone e exclui. O formulário é o mesmo de Documentos > Pessoais.
 */
export function CasaisPage() {
  const { data: pessoas = [], isLoading, isError } = useDocumentosPessoas();
  const { data: casalMembros = [] } = useCasalMembros();
  const { data: perfis = [] } = usePerfis();
  const souAdmin = useEhAdmin();
  const [modal, setModal] = useState<{ casal: PessoaDocumentos | null } | null>(null);

  const lista = casais(pessoas);
  const membros = membrosPorCasal(casalMembros);

  return (
    <div className="usuarios">
      <div className="usuarios-topo">
        <p className="conta-detalhe">Casais cadastrados em Documentos. Cada casal junta duas pessoas e tem os próprios documentos.</p>
        {souAdmin && (
          <button type="button" onClick={() => setModal({ casal: null })}>
            + Casal
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Carregando…</p>
      ) : isError ? (
        <p role="alert">Não foi possível carregar os casais.</p>
      ) : lista.length === 0 ? (
        <p className="hierarquia-vazio">Nenhum casal ainda.</p>
      ) : (
        <ul className="usuarios-lista">
          {lista.map((casal) => (
            <CasalLinha
              key={casal.id}
              casal={casal}
              membros={(membros.get(casal.id) ?? []).map((id) => pessoas.find((p) => p.id === id)).filter((p): p is PessoaDocumentos => !!p)}
              perfis={perfis}
              souAdmin={souAdmin}
              onEditar={() => setModal({ casal })}
            />
          ))}
        </ul>
      )}

      {modal && (
        <CriarCasalModal
          pessoas={pessoas}
          onFechar={() => setModal(null)}
          onSalvo={() => setModal(null)}
          casalExistente={modal.casal ? { casal: modal.casal, membroIds: membros.get(modal.casal.id) ?? [] } : undefined}
        />
      )}
    </div>
  );
}
