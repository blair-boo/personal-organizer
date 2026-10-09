# Ícones pendentes

Substitutos provisórios em uso (ver `src/components/IconesProvisorios.tsx`) ou
ícones novos ainda sem arquivo no bucket `icones`. Ao enviar o arquivo, trocar o
uso, remover o substituto e apagar a linha.

| Função / uso | Hoje | Nome sugerido |
|---|---|---|
| Adicionar (+) | SVG inline `IconeMais`; texto "+" | `plus.svg` |
| Mover (3 tracinhos) | SVG inline `IconeGrip` | `grip.svg` |
| Confirmar | caractere ✓ | `check.svg` |
| Fechar/cancelar | caractere × e `IconeX` | `x.svg` |
| Expandir/recolher | caracteres ▸ ▾ e `IconeChevron` | `chevron-right.svg`, `chevron-down.svg` |
| Tema claro | SVG inline `IconeSol` | `sol.svg` |
| Tema escuro | SVG inline `IconeLua` | `lua.svg` |
| Tema do sistema | SVG inline `IconeMonitor` | `monitor.svg` |
| Copiar | SVG inline `IconeCopiar` | `copy.svg` |
| Configurações/gerenciar | SVG inline `IconeEngrenagem` | `gear.svg` |
| Atualizar (novo) | não existe | `refresh.svg` |
| Selecionar (novo) | não existe | `select.svg` |
| Ver arquivo e baixar | confirmar se existem no bucket | `eye.svg`, `download.svg` |
| Xícara (categoria) | citada como faltando | `xícara.png` |
| Exportar CSV (novo) | SVG inline `IconeExportar` | `export.svg` |

Já enviado ao bucket (raiz): `Component_Randomized Pinpoint.png`, placeholder do
modo de edição. É um PNG branco com transparência, então deve ser usado com
máscara: `<IconeSupabase arquivo="Component_Randomized Pinpoint.png" />`.
