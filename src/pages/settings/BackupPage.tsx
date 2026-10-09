import { useMemo } from 'react';
import { IconeFuncao } from '../../components/IconeUso';
import { useBackupStatus } from '../../hooks/useBackupStatus';
import { backupAtrasado, formatarBytes, gravaMensal, limpaArquivos, proximoBackup } from '../../lib/backup';
import { mensagemDeErro } from '../../lib/erros';
import type { BackupSnapshot } from '../../types';

function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ListaBackups({ titulo, itens }: { titulo: string; itens: BackupSnapshot[] }) {
  return (
    <section>
      <h3>{titulo}</h3>
      {itens.length === 0 ? (
        <p className="hierarquia-vazio">Nenhum backup ainda.</p>
      ) : (
        <ul className="lista-contas">
          {itens.map((b) => (
            <li key={`${b.tipo}-${b.nome}`}>
              <span>{b.nome}</span>
              <span className="backup-item-info">
                {formatarBytes(b.tamanho_bytes)}
                {b.linhas !== null && ` · ${b.linhas.toLocaleString('pt-BR')} linhas`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Settings > Backup: o que existe hoje no R2 (só os backups atuais, os já
 * apagados pela retenção não aparecem), quando é o próximo e o tamanho do
 * bucket. Os dados vêm de backup_status, que o workflow de backup atualiza ao
 * terminar, então o tamanho é o do fim do último backup, não o do instante.
 */
export function BackupPage() {
  const { data: status, isLoading, error, refetch, isFetching } = useBackupStatus();
  const proximo = useMemo(() => proximoBackup(new Date()), []);
  const atrasado = status != null && backupAtrasado(status.atualizado_em, new Date());

  const semanais = status?.snapshots.filter((b) => b.tipo === 'semanal') ?? [];
  const mensais = status?.snapshots.filter((b) => b.tipo === 'mensal') ?? [];

  return (
    <div className="settings-secao">
      <h2>
        Backup{' '}
        <button
          type="button"
          className="btn-icone icone-uso-botao"
          onClick={() => void refetch()}
          disabled={isFetching}
          title="Atualizar"
          aria-label="Atualizar dados do backup"
        >
          <IconeFuncao funcao="atualizar" tamanho={18} />
        </button>
      </h2>
      <p className="settings-secao-ajuda">Cópias semanais do banco e dos arquivos, guardadas no Cloudflare R2.</p>

      <section>
        <h3>Próximo backup</h3>
        <p>
          <strong>{formatarDataHora(proximo)}</strong>
        </p>
        <p className="backup-nota">
          Roda todo domingo. O GitHub pode atrasar alguns minutos.
          {gravaMensal(proximo) && ' Este também grava a cópia mensal.'}
          {limpaArquivos(proximo) && ' Este também remove do backup os arquivos que não existem mais no app.'}
        </p>
      </section>

      {isLoading && <p className="hierarquia-vazio">Carregando…</p>}
      {error && <p className="testes-erro">Não foi possível carregar o backup: {mensagemDeErro(error)}</p>}
      {!isLoading && !error && status == null && (
        <p className="hierarquia-vazio">
          Nenhum backup registrado ainda. Rode o workflow no GitHub (Actions, Backup, Run workflow) ou aguarde o próximo domingo.
        </p>
      )}

      {status != null && (
        <>
          <section>
            <h3>Último backup</h3>
            <p>
              <strong>{formatarDataHora(new Date(status.atualizado_em))}</strong>
            </p>
            {atrasado && (
              <p className="testes-erro">Mais de uma semana sem backup novo. Confira o workflow Backup no GitHub Actions.</p>
            )}
          </section>

          <section>
            <h3>Tamanho do bucket</h3>
            <p>
              <strong>{formatarBytes(status.tamanho_total_bytes)}</strong>
            </p>
            <p className="backup-nota">
              Cópias do banco: {formatarBytes(status.tamanho_db_bytes)}. Arquivos: {formatarBytes(status.tamanho_arquivos_bytes)} (
              {status.objetos_arquivos.toLocaleString('pt-BR')} arquivos). Atualizado ao fim de cada backup.
            </p>
          </section>

          <ListaBackups titulo="Backups semanais" itens={semanais} />
          <ListaBackups titulo="Backups mensais" itens={mensais} />
        </>
      )}
    </div>
  );
}
