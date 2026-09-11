-- Contas/cartões: nome vira opcional; novo tipo cartao_beneficio (vale-alimentação/flash);
-- cartão passa a ser identificado por emissora + 4 dígitos + físico/virtual; cartão de
-- crédito pode ser vinculado à conta que paga a fatura; cartão benefício ganha valor e
-- dia de depósito mensal; e o booleano `ativo` vira `status` (ativo/inativo/cancelado/expirado)
-- pra cobrir cartão cancelado ou expirado que ainda tem compra pendente na fatura.

alter table contas alter column nome drop not null;

alter table contas drop constraint contas_tipo_check;
alter table contas add constraint contas_tipo_check
    check (tipo in ('conta_corrente', 'conta_poupanca', 'conta_investimento', 'cartao_credito', 'cartao_beneficio'));

alter table contas add column conta_vinculada_id uuid references contas(id) on delete set null;
alter table contas add column emissora text;
alter table contas add column ultimos_4_digitos text;
alter table contas add column formato text check (formato in ('fisico', 'virtual'));
alter table contas add column subtipo_virtual text check (subtipo_virtual in ('recorrente', 'expiravel'));
alter table contas add column valor_deposito_mensal numeric(12, 2);
alter table contas add column dia_deposito integer check (dia_deposito between 1 and 31);

alter table contas add column status text;
update contas set status = case when ativo then 'ativo' else 'inativo' end;
alter table contas alter column status set not null;
alter table contas alter column status set default 'ativo';
alter table contas add constraint contas_status_check check (status in ('ativo', 'inativo', 'cancelado', 'expirado'));
alter table contas drop column ativo;
