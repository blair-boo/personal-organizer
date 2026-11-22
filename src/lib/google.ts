import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from '../config';

/**
 * Salvar um arquivo no Google Drive como Google Sheets: login (Google Identity
 * Services), escolha da pasta (Google Picker) e envio (Drive API). Precisa de
 * internet e das credenciais em src/config.ts. O escopo `drive.file` só dá ao
 * app acesso ao que ele mesmo cria e às pastas que você escolhe no seletor.
 */

const ESCOPO = 'https://www.googleapis.com/auth/drive.file';
const SCRIPT_LOGIN = 'https://accounts.google.com/gsi/client';
const SCRIPT_API = 'https://apis.google.com/js/api.js';
export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TIPO_GOOGLE_SHEETS = 'application/vnd.google-apps.spreadsheet';

export function googleConfigurado(): boolean {
  return GOOGLE_CLIENT_ID !== '' && GOOGLE_API_KEY !== '';
}

interface RespostaDoToken {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface DocumentoEscolhido {
  id: string;
  name: string;
}

interface RespostaDoSeletor {
  action: string;
  docs?: DocumentoEscolhido[];
}

interface Seletor {
  setVisible(visivel: boolean): void;
}

interface ConstrutorDoSeletor {
  addView(visao: unknown): ConstrutorDoSeletor;
  setOAuthToken(token: string): ConstrutorDoSeletor;
  setDeveloperKey(chave: string): ConstrutorDoSeletor;
  setTitle(titulo: string): ConstrutorDoSeletor;
  setLocale(idioma: string): ConstrutorDoSeletor;
  setCallback(retorno: (resposta: RespostaDoSeletor) => void): ConstrutorDoSeletor;
  build(): Seletor;
}

interface VisaoDePastas {
  setSelectFolderEnabled(ligado: boolean): VisaoDePastas;
  setIncludeFolders(ligado: boolean): VisaoDePastas;
  setMimeTypes(tipos: string): VisaoDePastas;
}

interface GlobaisDoGoogle {
  accounts: {
    oauth2: {
      initTokenClient(config: { client_id: string; scope: string; callback: (resposta: RespostaDoToken) => void; error_callback?: (erro: { type: string }) => void }): {
        requestAccessToken(): void;
      };
    };
  };
  picker: {
    PickerBuilder: new () => ConstrutorDoSeletor;
    DocsView: new (tipo: unknown) => VisaoDePastas;
    ViewId: { FOLDERS: unknown };
    Action: { PICKED: string; CANCEL: string };
  };
}

function globais(): GlobaisDoGoogle {
  return (window as unknown as { google: GlobaisDoGoogle }).google;
}

const scriptsCarregados = new Map<string, Promise<void>>();

function carregarScript(url: string): Promise<void> {
  const existente = scriptsCarregados.get(url);
  if (existente) return existente;
  const carga = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptsCarregados.delete(url);
      reject(new Error('Não foi possível carregar o login do Google. Confira a internet e tente de novo.'));
    };
    document.head.appendChild(script);
  });
  scriptsCarregados.set(url, carga);
  return carga;
}

/** Abre o login do Google e devolve o token de acesso. */
export async function entrarNoGoogle(): Promise<string> {
  if (!googleConfigurado()) throw new Error('O login do Google ainda não foi configurado neste app.');
  await carregarScript(SCRIPT_LOGIN);
  return new Promise<string>((resolve, reject) => {
    globais()
      .accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: ESCOPO,
        callback: (resposta) => {
          if (resposta.access_token) resolve(resposta.access_token);
          else reject(new Error(resposta.error_description || resposta.error || 'O login do Google não foi concluído.'));
        },
        error_callback: (erro) => reject(new Error(erro.type === 'popup_closed' ? 'O login do Google foi fechado antes de terminar.' : 'Não foi possível abrir o login do Google.')),
      })
      .requestAccessToken();
  });
}

/** Abre o seletor de pastas do Drive. Devolve null se você fechar sem escolher. */
export async function escolherPastaDoDrive(token: string): Promise<{ id: string; nome: string } | null> {
  await carregarScript(SCRIPT_API);
  await new Promise<void>((resolve) => (window as unknown as { gapi: { load(nome: string, retorno: () => void): void } }).gapi.load('picker', resolve));
  const { picker } = globais();
  return new Promise((resolve) => {
    const visao = new picker.DocsView(picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes('application/vnd.google-apps.folder');
    new picker.PickerBuilder()
      .addView(visao)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle('Escolha a pasta do Drive')
      .setLocale('pt-BR')
      .setCallback((resposta) => {
        if (resposta.action === picker.Action.PICKED && resposta.docs?.[0]) resolve({ id: resposta.docs[0].id, nome: resposta.docs[0].name });
        else if (resposta.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}

/** Corpo "multipart/related" do envio: os dados do arquivo (JSON) e o conteúdo. */
export function montarCorpoMultipart(metadados: object, arquivo: Blob, tipoDoArquivo: string, limite: string): Blob {
  return new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadados)}\r\n`,
    `--${limite}\r\nContent-Type: ${tipoDoArquivo}\r\n\r\n`,
    arquivo,
    `\r\n--${limite}--`,
  ]);
}

/** Envia o .xlsx para a pasta, convertendo em Google Sheets. */
export async function enviarComoGoogleSheets(token: string, pastaId: string, nome: string, xlsx: Blob): Promise<{ id: string; link: string }> {
  const limite = `po-${crypto.randomUUID()}`;
  const corpo = montarCorpoMultipart({ name: nome, parents: [pastaId], mimeType: TIPO_GOOGLE_SHEETS }, xlsx, TIPO_XLSX, limite);
  const resposta = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: corpo,
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(`O Google Drive recusou o envio (${resposta.status}). ${detalhe.slice(0, 200)}`);
  }
  const dados = (await resposta.json()) as { id: string; webViewLink: string };
  return { id: dados.id, link: dados.webViewLink };
}
