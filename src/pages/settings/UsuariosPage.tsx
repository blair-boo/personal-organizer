import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useDialogos } from '../../components/Dialogo';
import { IconePessoa } from '../../components/IconePessoa';
import { IconePng } from '../../components/IconeSupabase';
import { IconeChevron } from '../../components/IconesProvisorios';
import { IconeFuncao } from '../../components/IconeUso';
import { ModalIcone } from '../../components/ModalIcone';
import { BotaoSalvarModal, ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { useAbasConfig } from '../../hooks/useAbasConfig';
import { useDocumentosPessoas, useRenomearPessoaDocumentos } from '../../hooks/useDocumentos';
import { useIconesUsos, useRemoverUsoIcone, useSalvarUsoIcone } from '../../hooks/useIconesUsos';
import { usePermissoesDoUsuario, useSalvarPermissoes } from '../../hooks/usePermissoes';
import { useTemaEfetivo } from '../../hooks/useTema';
import {
  useAlterarPapel,
  useConvidarUsuario,
  useEhAdmin,
  useExcluirUsuario,
  usePerfis,
  useTrocarEmail,
  useVincularPessoa,
  type ResultadoConvite,
} from '../../hooks/useUsuarios';
import { copiarConteudo } from '../../lib/clipboard';
import { mensagemDeErro } from '../../lib/erros';
import { resolverAbas, type AbaPadrao, type GrupoAbas } from '../../lib/abas';
import { resolverUso } from '../../lib/iconesUsos';
import { alternarPermissao, ICONES_PERMISSAO, linhasDePermissao, permissaoDe, type CampoPermissao, type Permissoes } from '../../lib/permissoesAbas';
import { emailValido, nomeDoUsuario, ordenarUsuarios, pessoaDoUsuario, pessoasParaVincular, podeEditarUsuario, podeExcluirUsuario, ROTULO_PAPEL } from '../../lib/usuarios';
import type { PapelUsuario, Perfil, PessoaDocumentos, UsoIcone } from '../../types';
import { CompartilharFinancas } from './CompartilharFinancas';

function ConvidarModal({ onFechar }: { onFechar: () => void }) {
  const { mostrarToast } = useToast();
  const convidar = useConvidarUsuario();
  const [email, setEmail] = useState('');
  const [semEmail, setSemEmail] = useState<ResultadoConvite | null>(null);

  async function enviar() {
    try {
      const resultado = await convidar.mutateAsync(email.trim());
      if (resultado.enviado) {
        mostrarToast(`Convite enviado para ${email.trim()}.`);
        onFechar();
      } else {
        setSemEmail(resultado);
      }
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <ModalBase
      aberto
      rotulo="Convidar usuário"
      onFechar={onFechar}
      classe="modal-edicao"
      titulo="Convidar usuário"
      perguntarAoDescartar={!semEmail}
      rodape={!semEmail && <BotaoSalvarModal form="form-convidar" disabled={!emailValido(email)} salvando={convidar.isPending} rotulo="Enviar convite" />}
    >
      {semEmail?.link ? (
        <div className="usuarios-link-convite">
          <p role="status">O login foi criado, mas o e-mail não pôde ser enviado ({semEmail.motivo}). Copie o link e envie para a pessoa.</p>
          <div className="usuarios-link-linha">
            <input type="text" readOnly value={semEmail.link} aria-label="Link de acesso" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-icone" onClick={() => void copiarConteudo(semEmail.link!, mostrarToast, 'Link de acesso')} title="Copiar link" aria-label="Copiar link de acesso">
              <IconeFuncao funcao="copiar" />
            </button>
          </div>
        </div>
      ) : (
        <form
          id="form-convidar"
          onSubmit={(e) => {
            e.preventDefault();
            if (emailValido(email)) void enviar();
          }}
        >
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required data-autofocus />
          </label>
          <p className="conta-detalhe">O login é criado agora. A pessoa escolhe a senha ao aceitar o convite.</p>
        </form>
      )}
    </ModalBase>
  );
}

function EditarUsuarioModal({ perfil, pessoa, ehVoce, onFechar }: { perfil: Perfil; pessoa: PessoaDocumentos | null; ehVoce: boolean; onFechar: () => void }) {
  const { mostrarToast } = useToast();
  const renomear = useRenomearPessoaDocumentos();
  const trocarEmail = useTrocarEmail();
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [email, setEmail] = useState(perfil.email);

  const nomeMudou = !!pessoa && nome.trim() !== '' && nome.trim() !== pessoa.nome;
  const emailMudou = ehVoce && email.trim().toLowerCase() !== perfil.email.toLowerCase();
  const invalido = (!!pessoa && !nome.trim()) || (emailMudou && !emailValido(email));

  async function salvar() {
    try {
      if (nomeMudou && pessoa) {
        await renomear.mutateAsync({ id: pessoa.id, nome: nome.trim() });
        mostrarToast('Nome salvo.');
      }
      if (emailMudou) {
        await trocarEmail.mutateAsync(email.trim());
        mostrarToast(`Enviamos um link de confirmação para ${email.trim()}. O e-mail só muda depois da confirmação.`, 'info');
      }
      onFechar();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <ModalBase
      aberto
      rotulo="Editar usuário"
      onFechar={onFechar}
      classe="modal-edicao"
      titulo="Editar usuário"
      rodape={<BotaoSalvarModal onClick={() => void salvar()} disabled={invalido || (!nomeMudou && !emailMudou)} salvando={renomear.isPending || trocarEmail.isPending} />}
    >
      {pessoa ? (
        <label>
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus />
        </label>
      ) : (
        <p className="conta-detalhe">Vincule uma pessoa a este login para ter nome e ícone.</p>
      )}
      {ehVoce ? (
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      ) : (
        <p className="conta-detalhe">E-mail: {perfil.email}. Só quem é dono do login troca o próprio e-mail.</p>
      )}
    </ModalBase>
  );
}

const GRUPOS_DE_NOMES: GrupoAbas[] = ['principal', 'settings', 'financas', 'apartamento', 'documentos'];

const ROTULO_CAMPO: Record<CampoPermissao, string> = { ver: 'Visualizar', editar: 'Editar' };

function CelulaPermissao({ campo, ligado, aba, onAlternar }: { campo: CampoPermissao; ligado: boolean; aba: string; onAlternar: () => void }) {
  const texto = `${ROTULO_CAMPO[campo]} ${aba}: ${ligado ? 'permitido' : 'não permitido'}. Clique para ${ligado ? 'tirar' : 'permitir'}.`;
  return (
    <button type="button" className="btn-icone" onClick={onAlternar} aria-pressed={ligado} title={texto} aria-label={texto}>
      <IconePng arquivo={ICONES_PERMISSAO[campo][ligado ? 'ligado' : 'desligado']} tamanho={22} />
    </button>
  );
}

/** Tabela de abas (principais com subabas recolhidas) com as colunas Visualizar e Editar. As mudanças ficam pendentes até salvar. */
function PermissoesAbas({ usuarioId, nome, onFechar }: { usuarioId: string; nome: string; onFechar: () => void }) {
  const { mostrarToast } = useToast();
  const { confirmar } = useDialogos();
  const { data: servidor, isLoading, isError } = usePermissoesDoUsuario(usuarioId);
  const { data: configs = [] } = useAbasConfig();
  const salvar = useSalvarPermissoes();
  const [rascunho, setRascunho] = useState<Permissoes | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const atual: Permissoes = rascunho ?? servidor ?? {};
  const nomes = new Map(GRUPOS_DE_NOMES.flatMap((grupo) => resolverAbas(grupo, configs).map((a) => [a.chave, a.nome || a.rotulo] as const)));
  const nomeDaAba = (chave: string) => nomes.get(chave) ?? chave;

  function alternar(chave: string, campo: CampoPermissao) {
    setRascunho(alternarPermissao(atual, chave, campo));
  }

  function alternarExpandida(chave: string) {
    setExpandidas((conjunto) => {
      const novo = new Set(conjunto);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  async function salvarPermissoes() {
    if (!rascunho) return;
    try {
      await salvar.mutateAsync({ usuarioId, permissoes: rascunho });
      mostrarToast(`Permissões de ${nome} salvas.`);
      setRascunho(null);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function fechar() {
    if (rascunho) {
      const ok = await confirmar({
        titulo: 'Descartar as alterações?',
        mensagem: `As mudanças nas permissões de ${nome} ainda não foram salvas.`,
        confirmarRotulo: 'Descartar',
        perigoso: true,
      });
      if (!ok) return;
    }
    onFechar();
  }

  function linha(aba: AbaPadrao, subaba: boolean, expansivel: boolean) {
    const permissao = permissaoDe(atual, aba.chave);
    const rotulo = nomeDaAba(aba.chave);
    const aberta = expandidas.has(aba.chave);
    return (
      <tr key={aba.chave} className={subaba ? 'permissoes-subaba' : undefined}>
        <th scope="row">
          <span className="permissoes-nome">
            {expansivel ? (
              <button
                type="button"
                className="btn-icone permissoes-expandir"
                onClick={() => alternarExpandida(aba.chave)}
                aria-expanded={aberta}
                title={`${aberta ? 'Recolher' : 'Expandir'} as abas de ${rotulo}`}
                aria-label={`${aberta ? 'Recolher' : 'Expandir'} as abas de ${rotulo}`}
              >
                <IconeChevron aberto={aberta} />
              </button>
            ) : (
              <span className="permissoes-sem-expandir" aria-hidden="true" />
            )}
            {rotulo}
          </span>
        </th>
        <td>
          <CelulaPermissao campo="ver" ligado={permissao.ver} aba={rotulo} onAlternar={() => alternar(aba.chave, 'ver')} />
        </td>
        <td>
          <CelulaPermissao campo="editar" ligado={permissao.editar} aba={rotulo} onAlternar={() => alternar(aba.chave, 'editar')} />
        </td>
      </tr>
    );
  }

  return (
    <div className="usuarios-permissoes">
      <div className="usuarios-permissoes-topo">
        <strong>Abas de {nome}</strong>
        <span className="usuarios-acoes">
          <button type="button" className="btn-icone" onClick={() => void salvarPermissoes()} disabled={!rascunho || salvar.isPending} title="Salvar permissões" aria-label="Salvar permissões">
            <IconeFuncao funcao="salvar" />
          </button>
          <button type="button" className="btn-icone" onClick={() => void fechar()} title="Fechar permissões" aria-label="Fechar permissões">
            <IconeFuncao funcao="fechar" />
          </button>
        </span>
      </div>
      {isLoading ? (
        <p>Carregando…</p>
      ) : isError ? (
        <p role="alert">Não foi possível carregar as permissões.</p>
      ) : (
        <table className="permissoes-tabela">
          <thead>
            <tr>
              <th scope="col">Aba</th>
              <th scope="col">{ROTULO_CAMPO.ver}</th>
              <th scope="col">{ROTULO_CAMPO.editar}</th>
            </tr>
          </thead>
          <tbody>
            {linhasDePermissao().flatMap(({ principal, subabas }) => [
              linha(principal, false, subabas.length > 0),
              ...(expandidas.has(principal.chave) ? subabas.map((s) => linha(s, true, false)) : []),
            ])}
          </tbody>
        </table>
      )}
      <p className="conta-detalhe">Quem não tem linha nesta tabela não vê nem edita nada. Admin vê e edita tudo. Ao marcar uma aba principal, a escolha vale para as subabas, que podem ser ajustadas depois. Vale só no app: o banco ainda não trava por aba.</p>
    </div>
  );
}

function UsuarioLinha({ perfil, pessoa, pessoas, souAdmin, ehVoce }: { perfil: Perfil; pessoa: PessoaDocumentos | null; pessoas: PessoaDocumentos[]; souAdmin: boolean; ehVoce: boolean }) {
  const { mostrarToast } = useToast();
  const { confirmar } = useDialogos();
  const { data: usosIcones = [] } = useIconesUsos();
  const temaEfetivo = useTemaEfetivo();
  const salvarUso = useSalvarUsoIcone();
  const removerUso = useRemoverUsoIcone();
  const alterarPapel = useAlterarPapel();
  const vincular = useVincularPessoa();
  const excluir = useExcluirUsuario();
  const [editando, setEditando] = useState(false);
  const [escolhendoIcone, setEscolhendoIcone] = useState(false);
  const [permissoesAbertas, setPermissoesAbertas] = useState(false);

  const nome = nomeDoUsuario(perfil, pessoa);
  const podeEditar = podeEditarUsuario(souAdmin, ehVoce);
  const podeExcluir = podeExcluirUsuario(souAdmin, ehVoce);

  async function mudarPapel(papel: PapelUsuario) {
    try {
      await alterarPapel.mutateAsync({ usuarioId: perfil.usuario_id, papel });
      mostrarToast(`${nome} agora é ${ROTULO_PAPEL[papel]}.`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function mudarPessoa(pessoaId: string) {
    try {
      await vincular.mutateAsync({ usuarioId: perfil.usuario_id, pessoaId: pessoaId || null });
      mostrarToast(pessoaId ? 'Pessoa vinculada.' : 'Pessoa desvinculada.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function excluirUsuario() {
    const ok = await confirmar({
      titulo: `Excluir ${nome}?`,
      mensagem: `O login ${perfil.email} é apagado e essa pessoa não consegue mais entrar. A pessoa cadastrada em Documentos continua, sem login vinculado. Essa ação não pode ser desfeita.`,
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(perfil.usuario_id);
      mostrarToast(`${nome} excluído.`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function aplicarIcone(uso: UsoIcone) {
    try {
      await salvarUso.mutateAsync(uso);
      mostrarToast(`Ícone de ${nome} salvo.`);
      setEscolhendoIcone(false);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function removerIcone() {
    if (!pessoa) return;
    const ok = await confirmar({
      titulo: 'Remover ícone?',
      mensagem: `O ícone sai de "${nome}". O arquivo continua disponível na lista de ícones.`,
      confirmarRotulo: 'Remover',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await removerUso.mutateAsync({ alvoTipo: 'pessoa', alvoId: pessoa.id });
      mostrarToast(`Ícone de ${nome} removido.`);
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
        disabled={!pessoa || !podeEditar}
        title={pessoa ? `Trocar ícone de ${nome}` : 'Vincule uma pessoa para ter ícone'}
        aria-label={pessoa ? `Trocar ícone de ${nome}` : 'Vincule uma pessoa para ter ícone'}
      >
        {pessoa ? (
          <IconePessoa pessoa={pessoa} tamanho={24} />
        ) : (
          <span className="pessoa-inicial" aria-hidden="true">
            {perfil.email.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      <div className="usuarios-identidade">
        <span className="usuarios-nome">{nome}</span>
        {pessoa && <span className="conta-detalhe">{perfil.email}</span>}
        <span className="usuarios-selos">
          {ehVoce && <span className="usuarios-selo">Você</span>}
          {!perfil.confirmado && <span className="usuarios-selo">Convite pendente</span>}
        </span>
      </div>

      <label className="usuarios-campo">
        Papel
        {souAdmin ? (
          <select value={perfil.papel} onChange={(e) => void mudarPapel(e.target.value as PapelUsuario)} disabled={alterarPapel.isPending}>
            <option value="admin">{ROTULO_PAPEL.admin}</option>
            <option value="membro">{ROTULO_PAPEL.membro}</option>
          </select>
        ) : (
          <span>{ROTULO_PAPEL[perfil.papel]}</span>
        )}
      </label>

      <label className="usuarios-campo">
        Pessoa
        {souAdmin ? (
          <select value={pessoa?.id ?? ''} onChange={(e) => void mudarPessoa(e.target.value)} disabled={vincular.isPending}>
            <option value="">Nenhuma</option>
            {pessoasParaVincular(pessoas, perfil.usuario_id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        ) : (
          <span>{pessoa?.nome ?? 'Nenhuma'}</span>
        )}
      </label>

      <div className="usuarios-acoes">
        {souAdmin &&
          (perfil.papel === 'admin' ? (
            <span className="conta-detalhe">Vê e edita tudo</span>
          ) : (
            <button type="button" onClick={() => setPermissoesAbertas((aberto) => !aberto)} aria-expanded={permissoesAbertas} title={`Permissões de ${nome}`} aria-label={`Permissões de ${nome}`}>
              Permissões
            </button>
          ))}
        {podeEditar && (
          <button type="button" className="btn-icone" onClick={() => setEditando(true)} title={`Editar ${nome}`} aria-label={`Editar ${nome}`}>
            <IconeFuncao funcao="editar" />
          </button>
        )}
        {podeExcluir && (
          <button type="button" className="btn-icone btn-icone-perigo" onClick={() => void excluirUsuario()} disabled={excluir.isPending} title={`Excluir ${nome}`} aria-label={`Excluir ${nome}`}>
            <IconeFuncao funcao="excluir" />
          </button>
        )}
      </div>

      {permissoesAbertas && souAdmin && <PermissoesAbas usuarioId={perfil.usuario_id} nome={nome} onFechar={() => setPermissoesAbertas(false)} />}
      {editando && <EditarUsuarioModal perfil={perfil} pessoa={pessoa} ehVoce={ehVoce} onFechar={() => setEditando(false)} />}
      {escolhendoIcone && pessoa && (
        <ModalIcone
          aberto
          rotuloAlvo={nome}
          alvoTipo="pessoa"
          alvoId={pessoa.id}
          inicial={resolverUso(usosIcones, 'pessoa', pessoa.id, temaEfetivo)}
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
 * Settings > Usuários: os logins do app, com papel (admin ou membro) e a pessoa de Documentos a que cada um
 * está ligado. Todos veem a lista. Só admin convida, exclui e muda papel e vínculo; cada um edita o próprio
 * nome, e-mail e ícone (o banco trava papel e vínculo para quem não é admin).
 */
export function UsuariosPage() {
  const { session } = useAuth();
  const { data: perfis, isLoading, isError } = usePerfis();
  const { data: pessoas = [] } = useDocumentosPessoas();
  const souAdmin = useEhAdmin();
  const [convidando, setConvidando] = useState(false);
  const meuId = session?.user.id;

  return (
    <div className="usuarios">
      <div className="usuarios-topo">
        <p className="conta-detalhe">Quem pode entrar no app. Cada login fica ligado a uma pessoa de Documentos.</p>
        {souAdmin && (
          <button type="button" onClick={() => setConvidando(true)}>
            + Usuário
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Carregando…</p>
      ) : isError ? (
        <p role="alert">Não foi possível carregar os usuários.</p>
      ) : !perfis || perfis.length === 0 ? (
        <p className="hierarquia-vazio">Nenhum usuário ainda.</p>
      ) : (
        <ul className="usuarios-lista">
          {ordenarUsuarios(perfis, pessoas, meuId).map((perfil) => (
            <UsuarioLinha
              key={perfil.usuario_id}
              perfil={perfil}
              pessoa={pessoaDoUsuario(pessoas, perfil.usuario_id)}
              pessoas={pessoas}
              souAdmin={souAdmin}
              ehVoce={perfil.usuario_id === meuId}
            />
          ))}
        </ul>
      )}

      <CompartilharFinancas />

      {convidando && <ConvidarModal onFechar={() => setConvidando(false)} />}
    </div>
  );
}
