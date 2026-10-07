import { Outlet } from 'react-router-dom';
import { useAbasEdicao } from '../../components/AbasEdicao';
import { IconeFuncao } from '../../components/IconeUso';
import { NavAbas } from '../../components/NavAbas';

export function SettingsLayout() {
  const edicao = useAbasEdicao();
  return (
    <div>
      <NavAbas grupo="settings" className="app-subnav" rota={(chave) => `/settings/${chave.split(':')[1]}`}>
        <button
          type="button"
          className={`btn-icone icone-uso-botao${edicao.editando ? ' categorias-modo-ativo' : ''}`}
          onClick={() => (edicao.editando ? void edicao.cancelar() : edicao.iniciar())}
          title={edicao.editando ? 'Sair do modo de edição das abas' : 'Editar abas (nome, ícone e ordem)'}
          aria-label={edicao.editando ? 'Sair do modo de edição das abas' : 'Entrar no modo de edição das abas'}
          aria-pressed={edicao.editando}
        >
          <IconeFuncao funcao="editar_abas" tamanho={18} />
        </button>
        <button
          type="button"
          className="btn-icone icone-uso-botao"
          onClick={() => void edicao.salvar()}
          disabled={!edicao.editando || !edicao.temAlteracoes || edicao.salvando}
          title="Salvar alterações das abas"
          aria-label="Salvar alterações das abas"
        >
          <IconeFuncao funcao="salvar" tamanho={18} />
        </button>
      </NavAbas>
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
