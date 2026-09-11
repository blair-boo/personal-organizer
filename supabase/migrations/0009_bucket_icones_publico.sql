-- Bucket "icones" passa a ser público pra leitura (mesmo padrão do bucket
-- "icons" do manga-lists): os ícones de interface (menu-list3, save, trash3...)
-- precisam carregar via URL pública sem autenticação. Upload/edição continua
-- exigindo usuário autenticado (policy já existente).
update storage.buckets set public = true where id = 'icones';
