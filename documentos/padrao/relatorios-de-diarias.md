# PADRÃO DE RELATÓRIOS — RV Engenharia
## Kit de referência para o Claude Code espelhar no aplicativo

**Para:** Claude Code
**De:** Rubens Veras Guimarães — RV Engenharia
**Objetivo:** o aplicativo deve produzir relatórios **idênticos** aos que foram gerados manualmente nesta conversa. Este kit contém o padrão escrito, os geradores de referência funcionando e os exemplos de saída. Nada aqui é sugestão: é o formato aprovado.

---

## 0. O que tem neste kit

```
Kit_Padrao_Relatorios_RV/
├── README_PADRAO_RELATORIOS.md      ← este arquivo (o padrão)
├── ESPECIFICACAO_APP_CONTROLE_DIARIAS.md  ← especificação do app (modelo de dados, regras, telas)
└── referencia/
    ├── relatorio_semanal.py         ← gerador de referência: PDF + XLSX da semana
    ├── relatorio_mensal.py          ← gerador de referência: PDF + XLSX do fechamento mensal
    ├── dados/obra_selecta.json      ← base completa da obra (equipe, semanas, 35 lançamentos)
    └── exemplos/                    ← saídas geradas pelos scripts acima (o resultado esperado)
```

### Como usar

1. Rode os geradores para ver o resultado esperado:
   ```
   pip install openpyxl reportlab
   python referencia/relatorio_semanal.py --dados referencia/dados/obra_selecta.json --semana 7 --saida saida
   python referencia/relatorio_mensal.py  --dados referencia/dados/obra_selecta.json --saida saida
   ```
2. **Os scripts Python são a fonte da verdade do layout.** Ao implementar no app, replique medidas, cores, ordem dos blocos e textos exatamente como estão lá. Não redesenhe. Se a stack do app for JavaScript/TypeScript, porte o script linha a linha; se for possível rodar Python no servidor, use o script diretamente.
3. Compare o que o app gera com os PDFs de `exemplos/`, lado a lado. Toda diferença é um bug.
4. O JSON de dados tem o formato exato que o app deve exportar para alimentar os geradores. Use-o como contrato.

---

## 1. Identidade visual (vale para tudo)

| Elemento | Valor |
|---|---|
| Azul institucional (faixas, bordas, títulos) | `#1F3864` |
| Azul claro (barras de seção) | `#D9E1F2` |
| Cinza (subtotais) | `#F2F2F2` |
| Verde (totais e gasto geral) | `#C6E0B4` |
| Linhas divisórias | `#BFBFBF` |
| Texto | `#262626` |
| Observações do dia | `#C00000`, itálico, 6,2 pt |
| Rodapé | `#808080`, itálico, 6,5 pt |
| Fonte no PDF | Helvetica (regular, bold, oblique) |
| Fonte na planilha | Arial |
| Moeda | `R$ 1.234,56` — sempre com "R$ " e vírgula decimal |
| Diárias | `1`, `0,5`, `11,5` — sem casas decimais desnecessárias |
| Datas | `DD/MM/AAAA` no cabeçalho, `DD/MM` em listas |
| Página | A4 **paisagem**, margem de 26 pt, **uma página só** |

O que **não** fazer: layout minimalista com muito branco; valor total em fonte gigante; fontes coloridas fora do padrão; mais de uma página; gráficos.

---

## 2. Relatório semanal — PDF

Arquivo: `Resumo_Semanal_<obra>_<dd-mm>-a-<dd-mm>.pdf`
Gerador: `referencia/relatorio_semanal.py` → função `gerar_pdf`

### Estrutura, de cima para baixo

**2.1 Cabeçalho** — faixa azul de 34 pt, largura total.
- Linha 1 (branco, bold 14): `CONTROLE DE DIÁRIAS E CUSTOS DE MÃO DE OBRA — SEMANA DD/MM A DD/MM/AAAA`
- Linha 2 (branco, 8,5): `Obra: <nome>  ·  <endereço>`
- À direita (branco, bold 10): `RV ENGENHARIA`

**2.2 Grade de dias** — 3 colunas, espaçamento 12 pt, uma ou duas linhas.
Um bloco por dia **lançado** (dias sem lançamento não aparecem). Cada bloco:
- Faixa azul 16 pt: dia da semana em maiúsculas à esquerda (`SEGUNDA-FEIRA`), data `DD/MM/AAAA` à direita.
- Cabeçalho azul-claro 12 pt: `FUNCIONÁRIO` · `FUNÇÃO` (a 42% da largura) · `DIÁRIAS` (centrado a 74%) · `VALOR` (alinhado à direita).
- Uma linha de 12 pt por funcionário presente, com linha divisória cinza.
- Linha cinza 13 pt: `Subtotal mão de obra (N diárias)` · valor.
- Linha cinza 13 pt: `Quentinhas: N un. × R$ X,XX` · valor.
- Observação do dia em vermelho itálico, se houver.
- Rodapé do bloco, faixa verde 17 pt com borda azul: `TOTAL DO DIA` · valor (bold 9).
- Todos os blocos da semana têm **a mesma altura**, calculada para caber tudo em uma página.

**2.3 Card "OBSERVAÇÕES DA SEMANA"** — ocupa os espaços vazios da grade (se a semana teve 5 dias, ocupa o 6º espaço; se teve 4, ocupa dois espaços). Lista datada: `DD/MM` em azul bold + texto. Se a semana teve 6 dias, o card não existe.

**2.4 Faixa "RESUMO GERAL DA SEMANA"** — azul, 15 pt, largura total.

**2.5 Coluna esquerda (60% da largura):**
- Bloco **GASTOS POR FUNCIONÁRIO**: cabeçalho `FUNCIONÁRIO · FUNÇÃO · VALOR DA DIÁRIA · DIÁRIAS NA SEMANA · TOTAL A PAGAR`. Uma linha por funcionário **com presença na semana** (quem não trabalhou não aparece). Linha cinza final: `TOTAL — MÃO DE OBRA DA SEMANA`.
- Bloco **ACUMULADO DA OBRA**: uma linha por semana já fechada (`Semana N — DD/MM a DD/MM` · diárias · mão de obra · alimentação · total) mais a semana atual. Linha verde final: `TOTAL ACUMULADO DA OBRA`.

**2.6 Coluna direita (40%):**
- Bloco **QUENTINHAS — SEPARADO POR VALOR UNITÁRIO**: uma linha por preço praticado na semana (`R$ 18,00` · dias em que foi usado · qtd. · custo). **Obrigatório mesmo com um único preço.** Linha cinza final: `TOTAL DE QUENTINHAS DA SEMANA`.
- Abaixo, sem caixa: `Total de mão de obra` e `Total de alimentação` com valores à direita.
- Caixa verde com borda azul 1,2 pt: `GASTO GERAL DA SEMANA` · valor (bold 11).

**2.7 Rodapé** (cinza itálico 6,5): `RV Engenharia · Resp. téc. Rubens Veras Guimarães · Valores de diária e quentinha conforme informado pela obra · Emitido em DD/MM/AAAA` — à direita `Página 1 de 1`.

---

## 3. Relatório semanal — planilha XLSX

Arquivo: `Controle_Diarias_<obra>_Semana<N>_<dd-mm>-a-<dd-mm>.xlsx`
Gerador: `referencia/relatorio_semanal.py` → função `gerar_xlsx`

### Abas, nesta ordem

1. **Parâmetros** — semana de referência; tabela `Funcionário · Função · Diária (R$) · Situação` só com quem trabalhou na semana; histórico de preço da quentinha (vigências contíguas); bloco "Como usar".
2. **Uma aba por dia**, nomeada `Segunda 31-08`, `Terça 01-09`, etc. Cada aba tem três seções numeradas:
   - `1. MÃO DE OBRA — DETALHAMENTO POR FUNCIONÁRIO`: `Funcionário · Função · Diária (R$) · Presença · Valor do Dia (R$)`, uma linha por funcionário da semana, subtotal com contagem de diárias.
   - `2. ALIMENTAÇÃO — QUENTINHAS DO DIA`: valor unitário e quantidade **daquele dia**, total.
   - `3. RESUMO DO DIA`: diárias, quentinhas, custo de M.O., custo de alimentação e `TOTAL DO DIA` em verde com borda grossa.
   - Observação do dia em vermelho itálico abaixo, se houver.
3. **Resumo Semanal** — cinco blocos numerados: `1. FECHAMENTO POR DIA` · `2. GASTOS POR FUNCIONÁRIO` · `3. GASTOS COM QUENTINHAS — SEPARADO POR VALOR UNITÁRIO` · `4. GASTO GERAL DA SEMANA` · `5. ACUMULADO DA OBRA`, mais uma nota final em itálico.

### Convenções da planilha
- Células de **preenchimento**: fundo amarelo `#FFF2CC`, texto azul `#0000FF`.
- Células **calculadas**: texto preto, sempre fórmula (nunca valor colado).
- Referências a outra aba: texto verde `#008000`.
- Cabeçalhos: fundo azul `#1F3864`, texto branco bold, centralizado, altura 28.
- Barras de seção: fundo azul-claro `#D9E1F2`, texto azul bold.
- Subtotais: fundo `#EDEDED`. Totais: fundo `#C6E0B4`; o total principal tem borda média azul.
- Formatos: moeda `R$ #,##0.00;-R$ #,##0.00;"-"` · diárias `0.0;-0.0;"-"` · inteiros `0;-0;"-"` · datas `DD/MM/YYYY`.
- Sem linhas de grade visíveis. Cada aba configurada para imprimir em uma página retrato.
- Os totais do bloco 1 (por dia) e do bloco 2 (por funcionário) devem bater — é a conferência interna.

---

## 4. Fechamento mensal — PDF e XLSX

Arquivos: `Fechamento_Mensal_<obra>.pdf` e `.xlsx`
Gerador: `referencia/relatorio_mensal.py`

### PDF (uma página, paisagem)
- Cabeçalho igual ao semanal, título `FECHAMENTO MENSAL DE DIÁRIAS E ALIMENTAÇÃO — <MÊS/ANO> A <MÊS/ANO>`.
- **Um card por mês do calendário**, lado a lado (3 colunas). Cada card: faixa azul com `MÊS/ANO` (e `· PARCIAL` no mês corrente) e o período; tabela das semanas que caem naquele mês (`Sem. N (DD/MM a DD/MM)` · dias · diárias · total); três linhas de resumo (`Dias com lançamento`, `Mão de obra` com nº de diárias, `Alimentação` com nº de unidades); faixa verde `TOTAL DE <MÊS>`.
- Faixa azul `DETALHAMENTO MÊS A MÊS`.
- Esquerda: `DIÁRIAS POR FUNCIONÁRIO, MÊS A MÊS` — uma coluna por mês (`JUL`, `AGO`, `SET`…), total de diárias e total pago; meses sem presença mostram `–`.
- Direita: `QUENTINHAS POR VALOR, MÊS A MÊS` — uma linha por preço, uma coluna por mês; depois os totais e a caixa verde `TOTAL ACUMULADO DA OBRA`.
- Três linhas de nota em itálico e o rodapé padrão.

### Regras
- **Cada dia conta no seu mês do calendário.** Uma semana que cruza a virada (ex.: 31/08 a 04/09) aparece inteira no relatório semanal e dividida no mensal.
- O primeiro mês começa na data de início da obra.
- O mês corrente é marcado como **PARCIAL**.

### XLSX
Aba `Resumo Mensal` (fechamento por mês, diárias por funcionário mês a mês, quentinhas por valor mês a mês) + **uma aba por mês** com lançamentos do mês, gastos por funcionário, quentinhas por valor e gasto geral.

---

## 5. Resumo diário no chat (formato de conversa)

Quando o usuário lança um dia, a resposta segue este formato — o app deve mostrar o mesmo na tela de lançamento, em tempo real:

```
**Quarta 02/09** — Thiago, Wiliton e Máximo, 3 quentinhas a R$ 18,00:

| | |
|---|---|
| Mão de obra (3 diárias) | R$ 500,00 |
| Quentinhas (3 un. × R$ 18,00) | R$ 54,00 |
| **Total do dia** | **R$ 554,00** |

Semana 7 acumulada: R$ 1.216,00 — 6 diárias, R$ 1.100,00 de mão de obra e R$ 116,00 de refeição.
```

Regras do resumo diário:
- Nome do dia + data curta em negrito; lista de presentes; quantidade e preço da quentinha.
- Tabela de duas colunas: mão de obra (com nº de diárias), quentinhas (qtd × unitário), total em negrito.
- Uma frase com o acumulado da semana: total, diárias, M.O. e refeição.
- Quando entra funcionário novo, uma tabela `Funcionário · Função · Diária` antes do resumo.
- Meia diária aparece como `0,5` na coluna de presença e o valor já calculado.

---

## 6. Regras de negócio que afetam os relatórios

Estão detalhadas na especificação do app, mas as que **mudam a saída** são:

1. **Só quem trabalhou na semana aparece** no relatório semanal — nas abas de dia, no bloco por funcionário e no card de equipe. Quem ficou zerado fica de fora daquela semana, sem sair do cadastro.
2. **Quentinhas separadas por valor unitário**, sempre. O preço é por dia, não por obra.
3. **Quantidade de quentinhas é livre** — pode ser maior que o número de presentes (unidade extra para o responsável). O relatório mostra o número real, com a explicação na observação.
4. **Sábado até meio-dia = diária integral**, sem quentinha (fica `0 un.`).
5. **Meia diária = fator 0,5** sobre a diária cheia.
6. **A semana fecha nos dias que tiveram lançamento** — pode terminar quinta, sexta ou sábado. Dias sem lançamento não geram bloco.
7. **Acumulado da obra** aparece em todo relatório semanal, com uma linha por semana já fechada.
8. **Correções retroativas** regeneram o relatório inteiro (já aconteceu duas vezes: uma sexta refeita e um funcionário esquecido na quarta).
9. **Observações datadas** (entrada/saída de funcionário, troca de fornecedor, quentinha extra, dia sem expediente) aparecem no bloco do dia em vermelho e no card da semana.

---

## 7. Formato de dados (contrato)

O app deve conseguir exportar exatamente este JSON. É o que os geradores consomem.

```json
{
  "obra": {"nome": "...", "endereco": "...", "empresa": "RV Engenharia",
           "responsavel": "Rubens Veras Guimarães", "crea": "CREA-PI 35900", "inicio": "2026-07-20"},
  "equipe": [
    {"nome": "Thiago", "funcao": "Pedreiro", "diaria": 200.0,
     "entrada": "2026-07-20", "saida": null, "status": "ativo"}
  ],
  "semanas": [{"numero": 1, "inicio": "2026-07-20", "fim": "2026-07-25"}],
  "lancamentos": [
    {"data": "2026-07-20", "presencas": {"Thiago": 1, "Gervasio": 1},
     "quentinhas": 2, "valor_quentinha": 22.0, "observacao": ""}
  ]
}
```

- `presencas`: mapa nome → fator (`1` ou `0.5`). Ausente = não trabalhou.
- `quentinhas` e `valor_quentinha`: por dia.
- `semanas`: segunda a sábado; o relatório usa só os dias que existem em `lancamentos`.
- O arquivo `referencia/dados/obra_selecta.json` é a base real, com 7 semanas — use para testar.

---

## 8. Conferência (os números que o app tem de reproduzir)

| Semana | Período | Diárias | M.O. | Quent. | Alimentação | Total |
|---|---|---|---|---|---|---|
| 1 | 20 a 25/07 | 16 | R$ 2.340,00 | 12 | R$ 264,00 | R$ 2.604,00 |
| 2 | 27 a 31/07 | 19 | R$ 2.370,00 | 19 | R$ 334,00 | R$ 2.704,00 |
| 3 | 03 a 07/08 | 14 | R$ 2.360,00 | 14 | R$ 246,00 | R$ 2.606,00 |
| 4 | 10 a 14/08 | 11,5 | R$ 2.025,00 | 13 | R$ 246,00 | R$ 2.271,00 |
| 5 | 17 a 20/08 | 12 | R$ 1.960,00 | 12 | R$ 216,00 | R$ 2.176,00 |
| 6 | 24 a 28/08 | 9 | R$ 1.800,00 | 9 | R$ 186,00 | R$ 1.986,00 |
| 7 | 31/08 a 04/09 | 10 | R$ 1.700,00 | 10 | R$ 188,00 | R$ 1.888,00 |
| **Acumulado** | | **91,5** | **R$ 14.555,00** | **89** | **R$ 1.680,00** | **R$ 16.235,00** |

| Mês | Dias | Diárias | M.O. | Alimentação | Total |
|---|---|---|---|---|---|
| Julho (20 a 31/07) | 11 | 35 | R$ 4.710,00 | R$ 598,00 | R$ 5.308,00 |
| Agosto | 20 | 48,5 | R$ 8.545,00 | R$ 938,00 | R$ 9.483,00 |
| Setembro (parcial, até 04/09) | 4 | 8 | R$ 1.300,00 | R$ 144,00 | R$ 1.444,00 |

Se o app gerar qualquer número diferente destes com a mesma base, o cálculo está errado.

---

## 9. Mensagem sugerida para o Claude Code

> Leia README_PADRAO_RELATORIOS.md e ESPECIFICACAO_APP_CONTROLE_DIARIAS.md. Rode os dois scripts de `referencia/` e abra os PDFs de `referencia/exemplos/`. O app deve gerar relatórios visualmente idênticos a esses PDFs e planilhas — mesmas cores, mesmos blocos, mesma ordem, mesmos textos. Antes de escrever código, me mostre lado a lado o que o app gera hoje e o exemplo de referência, e liste as diferenças. Depois corrija uma por uma, começando pelo PDF semanal.
