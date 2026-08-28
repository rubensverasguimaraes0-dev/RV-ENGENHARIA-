# Documentos

Peças de comunicação (não fazem parte do aplicativo).

## `RV-Engenharia-perguntas-modulo-solar.pdf`

Carta de duas páginas para enviar ao amigo que fez o aplicativo de energia
solar. Reúne as seis perguntas que faltam para copiar o fluxo dele
(conta de luz → proposta pronta), com destaque para os números do
dimensionamento (HSP, PR, disponibilidade mínima e degradação).

Gerado a partir de `carta.html` + `fontes.css` (IBM Plex embutida em
base64, para o PDF ficar idêntico em qualquer máquina).

Para gerar de novo depois de editar a carta:

```js
// node gerar.mjs — com playwright instalado
import { chromium } from 'playwright'
const nav = await chromium.launch()
const p = await nav.newPage()
await p.goto('file://' + process.cwd() + '/documentos/carta.html', { waitUntil: 'networkidle' })
await p.pdf({
  path: 'documentos/RV-Engenharia-perguntas-modulo-solar.pdf',
  format: 'A4', printBackground: true,
  margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
})
await nav.close()
```

## `guia-de-instalacao.html`

Guia de instalacao em tres fases (Supabase, Vercel, celular), com o
`supabase/instalar.sql` embutido para copiar de uma vez so — abre em
qualquer navegador, sem precisar de servidor.

Publicado em https://claude.ai/code/artifact/f84d35b4-76db-4505-99a3-70ad94da1a22

## `painel.html`

Painel de estado do projeto: o placar da verificacao, os tres passos que
faltam para por o app no ar (com marcacao que fica guardada no proprio
navegador) e todos os links reunidos.

Publicado em https://claude.ai/code/artifact/d70abaca-5e21-4c0f-a134-2a9587c1e1c5
