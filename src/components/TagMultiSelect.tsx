interface TagBase {
  id: string;
  nome: string;
}

export function TagMultiSelect<T extends TagBase>({
  todasTags,
  selecionadas,
  onChange,
}: {
  todasTags: T[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
}) {
  function alternar(id: string) {
    onChange(selecionadas.includes(id) ? selecionadas.filter((s) => s !== id) : [...selecionadas, id]);
  }

  if (todasTags.length === 0) {
    return <p className="settings-secao-ajuda">Nenhuma tag cadastrada ainda — crie em Settings.</p>;
  }

  return (
    <div className="tag-multi-select">
      {todasTags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className={selecionadas.includes(tag.id) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
          onClick={() => alternar(tag.id)}
          aria-pressed={selecionadas.includes(tag.id)}
        >
          {tag.nome}
        </button>
      ))}
    </div>
  );
}
