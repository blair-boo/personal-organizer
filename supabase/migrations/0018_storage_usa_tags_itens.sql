-- Os itens das caixas passam a usar as mesmas tags (cômodos) dos itens de
-- Apartamento (tags_itens), em vez de uma lista própria de classificações.
-- A tabela storage_categorias só existia para isso e fica sem uso.
update storage_itens set categoria_id = null;

alter table storage_itens drop constraint storage_itens_categoria_id_fkey;
alter table storage_itens rename column categoria_id to tag_id;
alter table storage_itens
    add constraint storage_itens_tag_id_fkey foreign key (tag_id) references tags_itens(id) on delete set null;
alter index idx_storage_itens_categoria rename to idx_storage_itens_tag;

drop table storage_categorias;
