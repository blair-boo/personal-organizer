interface TagBase {
  id: string;
  nome: string;
}

export function TagsChips({ tags }: { tags: { id: string; nome: string }[] | undefined }) {
  if (!tags || tags.length === 0) return <span className="conta-detalhe">Sem tag</span>;
  return (
    <span className="tags-chips">
      {tags.map((tag: TagBase) => (
        <span key={tag.id} className="tag-chip">
          {tag.nome}
        </span>
      ))}
    </span>
  );
}
