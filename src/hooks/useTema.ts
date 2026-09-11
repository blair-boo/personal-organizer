import { useEffect, useState } from 'react';

export type TemaPref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tema';

function lerTemaSalvo(): TemaPref {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

// --accent claro/escuro de src/styles/base.css, duplicado de propósito (mesmo
// motivo do script inline em index.html, que faz a mesma coisa antes do 1º
// paint): não dá pra ler uma custom property antes do CSS carregar.
const ACCENT_POR_TEMA: Record<'light' | 'dark', string> = { light: '#0f4c3a', dark: '#134e3a' };

function temaResolvido(pref: TemaPref): 'light' | 'dark' {
  if (pref === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return pref;
}

function aplicarTema(pref: TemaPref) {
  const root = document.documentElement;
  if (pref === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', pref);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', ACCENT_POR_TEMA[temaResolvido(pref)]);
}

/**
 * Preferência de tema (claro/escuro/sistema) persistida em localStorage.
 * No modo "system" a preferência do SO (@media prefers-color-scheme) vale;
 * caso contrário `data-theme` no <html> vence via CSS.
 */
export function useTema() {
  const [tema, setTemaState] = useState<TemaPref>(lerTemaSalvo);

  useEffect(() => {
    aplicarTema(tema);
    if (tema !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => aplicarTema('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [tema]);

  function setTema(pref: TemaPref) {
    setTemaState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
  }

  function ciclarTema() {
    setTema(tema === 'light' ? 'dark' : tema === 'dark' ? 'system' : 'light');
  }

  return { tema, setTema, ciclarTema };
}
