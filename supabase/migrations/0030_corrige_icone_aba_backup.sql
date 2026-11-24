-- O ícone da aba Backup apontava para save.svg na raiz do bucket `icones`, mas o arquivo
-- hoje está em Antigos/save.svg. Ao abrir Settings > Ícones a cópia para `em-uso` falhava
-- com "Object not found". Aponta o uso para onde o arquivo realmente está.
update icones_usos
set icone_pasta = 'Antigos'
where alvo_tipo = 'aba' and alvo_id = 'settings:backup' and icone_pasta = '' and icone_arquivo = 'save.svg';
