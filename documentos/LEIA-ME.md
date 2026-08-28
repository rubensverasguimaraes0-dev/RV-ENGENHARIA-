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
