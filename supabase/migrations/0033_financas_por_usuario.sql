-- Finanças por usuário, com compartilhamento (ver/editar) e área Conjunto.
--  * contas passam a ter dono (dono_id). Lançamentos e importações herdam o dono pela conta.
--  * Conta conjunta: contas.conjunta = true, com os donos em contas_donos (inclui o dono_id).
--  * Despesa conjunta numa conta individual: lancamentos.conjunto = true + conjunto_com (com quem divide)
--    + divisao_percentual (parte de quem pagou, padrão 50).
--  * financas_acessos: o dono libera suas finanças a outro login, com nível 'ver' ou 'editar'.
--  * regras_categorizacao (banco de lançamentos) por dono; dono_id nulo = regras do Conjunto.
--  * categorias continuam globais.
-- Os dados que já existem ficam com a Mariana (ou, sem vínculo, o login mais antigo), igual a 0032.

-- 1) Colunas novas ---------------------------------------------------------------------------

alter table contas
    add column dono_id uuid references auth.users(id) on delete restrict default auth.uid(),
    add column conjunta boolean not null default false;

alter table lancamentos
    add column conjunto boolean not null default false,
    add column conjunto_com uuid references auth.users(id) on delete set null,
    add column divisao_percentual numeric(5,2) not null default 50
        check (divisao_percentual >= 0 and divisao_percentual <= 100),
    add constraint lancamentos_conjunto_exige_parceiro check (not conjunto or conjunto_com is not null);

alter table regras_categorizacao
    add column dono_id uuid references auth.users(id) on delete cascade;

-- Backfill: tudo que existe hoje é da Mariana.
do $$
declare
    v_dono uuid := coalesce(
        (select usuario_id from documentos_pessoas where nome = 'Mariana' and usuario_id is not null limit 1),
        (select id from auth.users order by created_at limit 1)
    );
begin
    if v_dono is null then
        if exists (select 1 from contas) or exists (select 1 from regras_categorizacao) then
            raise exception 'Há dados de finanças, mas nenhum login para ser o dono.';
        end if;
    else
        update contas set dono_id = v_dono where dono_id is null;
        update regras_categorizacao set dono_id = v_dono where dono_id is null;
    end if;
end $$;

alter table contas alter column dono_id set not null;
create index contas_dono_idx on contas (dono_id);
create index lancamentos_conjunto_com_idx on lancamentos (conjunto_com) where conjunto;

-- A regra deixa de ser única no app inteiro: passa a ser única por dono (nulo = Conjunto).
alter table regras_categorizacao drop constraint regras_categorizacao_descricao_normalizada_key;
alter table regras_categorizacao
    add constraint regras_categorizacao_dono_descricao_key
    unique nulls not distinct (dono_id, descricao_normalizada);

-- 2) Tabelas de vínculo ---------------------------------------------------------------------

create table contas_donos (
    conta_id uuid not null references contas(id) on delete cascade,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    primary key (conta_id, usuario_id)
);

create table financas_acessos (
    dono_id uuid not null references auth.users(id) on delete cascade,
    convidado_id uuid not null references auth.users(id) on delete cascade,
    nivel text not null check (nivel in ('ver', 'editar')),
    criado_em timestamptz not null default now(),
    primary key (dono_id, convidado_id),
    check (dono_id <> convidado_id)
);

create index financas_acessos_convidado_idx on financas_acessos (convidado_id);

alter table contas_donos enable row level security;
alter table financas_acessos enable row level security;

-- 3) Funções de permissão (security definer: leem as tabelas sem passar pela RLS) -----------

create function tem_acesso_financas(p_dono uuid, p_editar boolean) returns boolean
language sql stable security definer set search_path = public as $$
    select p_dono = auth.uid()
        or exists (
            select 1 from financas_acessos a
            where a.dono_id = p_dono
              and a.convidado_id = auth.uid()
              and (not p_editar or a.nivel = 'editar')
        );
$$;

create function pode_ver_conta(p_conta uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from contas c
        where c.id = p_conta
          and (
              tem_acesso_financas(c.dono_id, false)
              or exists (select 1 from contas_donos d where d.conta_id = c.id and d.usuario_id = auth.uid())
          )
    );
$$;

create function pode_editar_conta(p_conta uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from contas c
        where c.id = p_conta
          and (
              tem_acesso_financas(c.dono_id, true)
              or exists (select 1 from contas_donos d where d.conta_id = c.id and d.usuario_id = auth.uid())
          )
    );
$$;

-- Quem participa de algum Conjunto (conta conjunta ou despesa dividida), para as regras do Conjunto.
create function participa_do_conjunto() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
            select 1 from contas_donos d join contas c on c.id = d.conta_id
            where d.usuario_id = auth.uid() and c.conjunta
        )
        or exists (select 1 from lancamentos l where l.conjunto and l.conjunto_com = auth.uid())
        or exists (
            select 1 from lancamentos l join contas c on c.id = l.conta_id
            where l.conjunto and c.dono_id = auth.uid()
        );
$$;

revoke all on function tem_acesso_financas(uuid, boolean) from public;
revoke all on function pode_ver_conta(uuid) from public;
revoke all on function pode_editar_conta(uuid) from public;
revoke all on function participa_do_conjunto() from public;
grant execute on function tem_acesso_financas(uuid, boolean) to authenticated;
grant execute on function pode_ver_conta(uuid) to authenticated;
grant execute on function pode_editar_conta(uuid) to authenticated;
grant execute on function participa_do_conjunto() to authenticated;

-- O dono de uma conta só muda pelo próprio dono (editor com acesso não toma a conta).
create function contas_proteger_dono() returns trigger
language plpgsql as $$
begin
    if new.dono_id is distinct from old.dono_id and auth.uid() is not null and auth.uid() <> old.dono_id then
        raise exception 'Só o dono da conta pode transferi-la.';
    end if;
    return new;
end;
$$;

create trigger contas_proteger_dono
    before update of dono_id on contas
    for each row execute function contas_proteger_dono();

-- 4) Policies ---------------------------------------------------------------------------------

drop policy "authenticated_full_access_contas" on contas;
drop policy "authenticated_full_access_importacoes" on importacoes;
drop policy "authenticated_full_access_lancamentos" on lancamentos;
drop policy "authenticated_full_access_regras_categorizacao" on regras_categorizacao;

-- contas
create policy "contas_leitura" on contas
    for select to authenticated using (pode_ver_conta(id));
create policy "contas_insercao" on contas
    for insert to authenticated with check (tem_acesso_financas(dono_id, true));
create policy "contas_alteracao" on contas
    for update to authenticated
    using (pode_editar_conta(id)) with check (tem_acesso_financas(dono_id, true) or pode_editar_conta(id));
create policy "contas_exclusao" on contas
    for delete to authenticated using (pode_editar_conta(id));

-- contas_donos
create policy "contas_donos_leitura" on contas_donos
    for select to authenticated using (pode_ver_conta(conta_id));
create policy "contas_donos_escrita" on contas_donos
    for all to authenticated using (pode_editar_conta(conta_id)) with check (pode_editar_conta(conta_id));

-- importacoes (herdam a conta)
create policy "importacoes_leitura" on importacoes
    for select to authenticated using (pode_ver_conta(conta_id));
create policy "importacoes_escrita" on importacoes
    for all to authenticated using (pode_editar_conta(conta_id)) with check (pode_editar_conta(conta_id));

-- lancamentos (herdam a conta; quem divide uma despesa conjunta também enxerga aquele lançamento)
create policy "lancamentos_leitura" on lancamentos
    for select to authenticated
    using (pode_ver_conta(conta_id) or (conjunto and conjunto_com = auth.uid()));
create policy "lancamentos_escrita" on lancamentos
    for all to authenticated using (pode_editar_conta(conta_id)) with check (pode_editar_conta(conta_id));

-- regras_categorizacao (banco de lançamentos)
create policy "regras_leitura" on regras_categorizacao
    for select to authenticated
    using (
        (dono_id is null and participa_do_conjunto())
        or (dono_id is not null and tem_acesso_financas(dono_id, false))
    );
create policy "regras_escrita" on regras_categorizacao
    for all to authenticated
    using (
        (dono_id is null and participa_do_conjunto())
        or (dono_id is not null and tem_acesso_financas(dono_id, true))
    )
    with check (
        (dono_id is null and participa_do_conjunto())
        or (dono_id is not null and tem_acesso_financas(dono_id, true))
    );

-- financas_acessos: o dono gerencia; o convidado só enxerga o que recebeu.
create policy "financas_acessos_leitura" on financas_acessos
    for select to authenticated using (dono_id = auth.uid() or convidado_id = auth.uid());
create policy "financas_acessos_escrita" on financas_acessos
    for all to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());
