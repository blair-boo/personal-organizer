export const APP_NAME = 'Personal Organizer';

/**
 * Login do Google para salvar a exportação no Drive. Os dois valores são
 * públicos por natureza (vão no bundle do app); a segurança está nas restrições
 * que se configuram no Google Cloud (origem autorizada e APIs permitidas).
 * Como criar: README, seção "Exportar tarefas para planilha". Vazio = o botão do
 * Google Drive fica desligado e só o download do .xlsx funciona.
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const GOOGLE_API_KEY: string = import.meta.env.VITE_GOOGLE_API_KEY || '';
