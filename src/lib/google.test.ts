import { describe, expect, it } from 'vitest';
import { montarCorpoMultipart, TIPO_XLSX } from './google';

describe('montarCorpoMultipart', () => {
  it('põe os dados do arquivo e o conteúdo entre os limites', async () => {
    const corpo = montarCorpoMultipart({ name: 'Tarefas', parents: ['pasta1'] }, new Blob(['conteudo']), TIPO_XLSX, 'LIMITE');
    const texto = await corpo.text();
    expect(texto.startsWith('--LIMITE\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n')).toBe(true);
    expect(texto).toContain('{"name":"Tarefas","parents":["pasta1"]}');
    expect(texto).toContain(`--LIMITE\r\nContent-Type: ${TIPO_XLSX}\r\n\r\nconteudo\r\n--LIMITE--`);
  });

  it('não mexe nos bytes do arquivo', async () => {
    const bytes = new Uint8Array([0, 255, 10, 13, 128]);
    const corpo = montarCorpoMultipart({}, new Blob([bytes]), TIPO_XLSX, 'L');
    const todos = new Uint8Array(await corpo.arrayBuffer());
    const inicio = todos.findIndex((_, i) => todos[i] === 0 && todos[i + 1] === 255 && todos[i + 2] === 10);
    expect([...todos.slice(inicio, inicio + 5)]).toEqual([0, 255, 10, 13, 128]);
  });
});
