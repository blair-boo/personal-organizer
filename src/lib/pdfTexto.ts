/** Extrai o texto de um PDF linha a linha, usando pdf.js no navegador. */
export async function extrairTextoPdf(arquivo: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const linhas: string[] = [];
  for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
    const pagina = await pdf.getPage(numPagina);
    const conteudo = await pagina.getTextContent();

    let partesLinha: string[] = [];
    for (const item of conteudo.items) {
      if (!('str' in item)) continue;
      partesLinha.push(item.str);
      if (item.hasEOL) {
        linhas.push(partesLinha.join('').trim());
        partesLinha = [];
      }
    }
    if (partesLinha.length > 0) linhas.push(partesLinha.join('').trim());
  }
  return linhas.filter(Boolean).join('\n');
}
