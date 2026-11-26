import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { APP_NAME } from '../config';
import { erroDeSenha } from '../lib/usuarios';

/** Primeiro acesso por convite (ou recuperação de senha): a pessoa escolhe a senha com que vai entrar da próxima vez. */
export function DefinirSenhaPage() {
  const { definirSenha, signOut } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalida = erroDeSenha(senha, confirmacao);
    if (invalida) {
      setError(invalida);
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await definirSenha(senha);
    setLoading(false);
    if (error) setError(error);
  }

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>{APP_NAME}</h1>
        <p className="login-subtitle">Escolha a senha para os próximos acessos.</p>
        <label>
          Nova senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required data-autofocus />
        </label>
        <label>
          Repita a senha
          <input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Salvando…' : 'Salvar senha'}
        </button>
        <button type="button" onClick={() => void signOut()}>
          Sair
        </button>
      </form>
    </div>
  );
}
