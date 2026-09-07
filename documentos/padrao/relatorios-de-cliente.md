# Padrões de Relatórios — RV Engenharia

Documento de referência para o Claude Code. Define **como os documentos da RV
Engenharia têm de sair** do aplicativo: identidade visual, anatomia de cada
tipo de relatório, formatos numéricos e regras de conteúdo.

O objetivo é que o app gere documentos **idênticos** aos que já são enviados
aos clientes hoje. O arquivo `rv_report_kit.py` acompanha este guia e é a
implementação de referência — quando houver dúvida sobre um detalhe visual,
o código é a fonte da verdade.

---

## 0. Erros mais comuns a evitar

Esta lista existe porque cada item já causou retrabalho:

| Erro | Consequência | Correção |
|---|---|---|
| Usar formato de moeda `"R$" #,##0.00` | PDF sai `R$ 67,029.64` (padrão americano) | Usar `[$-416]"R$" #,##0.00` |
| Inserir a logo ancorada em `A1` | Marca desalinhada, colada à esquerda | `OneCellAnchor` com deslocamento calculado em EMU |
| Usar o PNG original da logo | Sobra transparente assimétrica desloca a marca | Recortar as margens antes (`trim_logo`) |
| `wrap_text=True` em rótulo estreito | "RESPONSÁVEL:" quebra em "RESPONS / ÁVEL:" | `wrap=False` em rótulos e notas |
| Gravar o valor do balão fixo | Aditivo na obra desalinha o total | Balão = fórmula `total − acumulado anterior` |
| Colocar a forma de pagamento no cabeçalho | Ela muda a cada parcela | Coluna própria, por parcela |
| Valor total em fonte muito grande | Fica agressivo para o cliente | Máx. 12 pt no painel |
| Documento minimalista, muito branco | Já foi rejeitado | Tabelas com seções, colorido, denso |
| Somar semanas de despesa entre si | Cada semana é um documento fechado | Totais independentes por semana |

---

## 1. Identidade visual

### Cores (hex, sem `#`)

| Token | Valor | Uso |
|---|---|---|
| `NAVY` | `1F3864` | Faixa do cabeçalho, cabeçalho de tabela, linha de total |
| `BLUE` | `2E5395` | Barra do título do documento |
| `LIGHT` | `DCE6F1` | Destaque de linha (parcela balão, linha de ênfase) |
| `BAND` | `E9EDF4` | Faixa separadora de mês/seção |
| `GRAY` | `F2F2F2` | Rótulos do bloco de dados, cards neutros |
| `GREEN` | `E2EFDA` | Linha quitada, card "Total Pago" |
| `GREEN_TX` | `375623` | Texto do card "Total Pago" |

### Tipografia
- Fonte única: **Arial**.
- Corpo de tabela 10 pt; rótulos e observações 9 pt; título do documento 12 pt;
  valores do painel 12 pt (**nunca maior**).
- Negrito só em: cabeçalhos, totais, linha do balão e status.

### Logo
- Arquivo original tem margem transparente assimétrica → **recortar antes**.
- Sempre centralizada (horizontal e vertical) sobre a faixa navy do cabeçalho.
- Altura ≈ 66 px na planilha; 13 mm nas páginas de anexo em PDF.
- Tolerância de centralização: ≤ 1 px. Conferir medindo o render, não a olho.

### Página
- **A4 retrato**, ajustar à largura (`fitToWidth = 1`, `fitToHeight = 0`).
- Margens: 0,35" laterais / 0,45" topo e base.
- Linhas de grade **desligadas**.
- `print_area` explícita, para não sair página em branco.
- Documento de rotina deve caber em **1 página**.

### Formatos
| Tipo | Formato | Exemplo |
|---|---|---|
| Moeda | `[$-416]"R$" #,##0.00` | R$ 67.029,64 |
| Percentual | `[$-416]0.0%` | 44,8% |
| Data | `DD/MM/YYYY` | 23/07/2026 |
| Área | `#,##0.00 "m²"` | 101,94 m² |
| Dia da semana | minúsculo, por extenso | sábado |
| Mês nas faixas | maiúsculo + ano | AGOSTO/2026 |

---

## 2. Anatomia padrão de um documento

Todo documento segue esta ordem vertical:

```
┌──────────────────────────────────────────┐
│ 1. FAIXA NAVY com a logo centralizada    │  3 linhas de 30 pt
├──────────────────────────────────────────┤
│ 2. BARRA AZUL — nome do documento        │  1 linha, 12 pt, branco
├──────────────────────────────────────────┤
│ 3. BLOCO DE DADOS (2 colunas)            │  rótulo cinza + valor
│    OBRA / CLIENTE / RESPONSÁVEL          │  9 pt, sem wrap
│    REGIME / ORÇAMENTO / PARCELAS         │
├──────────────────────────────────────────┤
│ 4. PAINEL DE INDICADORES (cards)         │  rótulo navy + valor 12 pt
├──────────────────────────────────────────┤
│ 5. TABELA PRINCIPAL                      │  cabeçalho navy, faixas de mês
│    ...linhas agrupadas por seção...      │  linha concluída em verde
│    TOTAL GERAL                           │  faixa navy
├──────────────────────────────────────────┤
│ 6. COMO ACOMPANHAR / OBSERVAÇÕES         │  9 pt, itálico, numeradas
├──────────────────────────────────────────┤
│ 7. ASSINATURA do responsável técnico     │  linha + nome + cargo
└──────────────────────────────────────────┘
```

Anexos (fotos de notas, comprovantes) vêm **depois**, uma página por item.

---

## 3. Documentos por tipo

### 3.1 Cronograma físico-financeiro de pagamentos

**Colunas:** Parcela | Vencimento | Dia | Valor | Acumulado | Saldo Devedor |
Pago | Forma de Pgto. | Status

**Painel:** Valor Total da Obra · Total Pago · Saldo a Pagar · % Quitado

**Regras:**
1. Acumulado e saldo são **fórmulas**, nunca valores digitados.
2. Parcela balão = `valor_total − acumulado anterior`. Se a obra receber
   aditivo, o balão se ajusta e os adiantamentos ficam fixos.
3. `Pago` = "X" digitado pelo usuário. Status, cor da linha e os quatro
   indicadores derivam disso: `=IF(UPPER(G14)="X";"QUITADO";"A VENCER")`.
4. Formatação condicional pinta a linha inteira de verde quando quitada.
5. `Forma de Pgto.` é **por parcela**, com lista suspensa Pix / Espécie.
   Nunca tratar como propriedade da obra.
6. Faixas separadoras por mês (JULHO/2026, AGOSTO/2026…).
7. Painéis congelados (`freeze_panes`) abaixo do cabeçalho da tabela.
8. **Vencimento e data efetiva de pagamento são campos distintos.** Quando o
   pagamento sai fora do vencimento, a coluna mantém a data prevista e a data
   real vai na observação nº 2 (e no banco, em `data_pagamento`).

### 3.2 Anexo de comprovantes de pagamento

Uma página por comprovante, sempre após o cronograma:
- Faixa navy: logo à esquerda; à direita "COMPROVANTE DE PAGAMENTO" e a linha
  "Obra: X | Cliente: Y".
- Tarja clara com quatro campos: **Parcela n/total · Data · Valor · Forma**.
- Imagem do comprovante centralizada, ajustada ao espaço restante mantendo
  proporção.
- Rodapé: "RV Engenharia — Engenharia e Construções".

### 3.3 Relatório semanal de despesas (notas fiscais)

- **Duas saídas por semana:** resumo de 1 página para o cliente + relatório
  completo com o detalhamento.
- Cada semana é um documento **fechado**: não soma com outras semanas nem com
  o recibo de pagamento de mão de obra.
- Notas pagas diretamente pelo cliente na loja entram em **seção separada**,
  marcadas "pago pelo cliente / não repassar", e **não** entram no valor a
  repassar à RV.
- O documento mostra **dois totais distintos**: a repassar à RV × pago pelo
  cliente.
- Ao final do relatório completo, as **fotos de todas as notas** anexadas,
  uma por página, no mesmo padrão da seção 3.2.
- Cabeçalho de cada nota: fornecedor, número do documento, data, valor e quem
  adiantou.

### 3.4 Planilha de diárias e quentinhas (semanal)

- **Uma aba por dia da semana** + aba de resumo geral. Cada aba traz o detalhe
  por funcionário, as quentinhas do dia e um resumo ao pé.
- Também gerar versão **PDF de página única**.
- Listar **apenas** funcionários que efetivamente trabalharam na semana.
- Quentinhas **separadas por valor unitário** (faixas já usadas: R$ 15,00,
  R$ 18,00 e R$ 22,00), com quantidade e custo de cada faixa.
- A quantidade de quentinhas pode não bater com a presença (às vezes há uma a
  mais, do próprio responsável) — não validar como erro.
- Sábado: expediente só até meio-dia, **sem** quentinha, mas **diária cheia**.
- Meia diária existe (ex.: entrada fora do horário) e deve ser suportada.
- Funcionário ausente pode estar alocado em outro serviço — ausência não é
  desligamento.

### 3.5 Relatório mensal de diárias

Mesmo conteúdo do semanal, fechado por **mês do calendário**, como documento
separado (o primeiro cobriu julho parcial, agosto e setembro parcial). Meses
parciais devem indicar o período coberto.

### 3.6 Orçamento de serviço ao cliente

- Cabeçalho padrão + descrição do serviço + quantitativo + preço.
- Mostrar **preço de venda** (R$/m² ou R$/m linear) e o total; o custo apurado
  é uso interno.
- Itens cobrados à parte entram como linha própria (ex.: sanca por metro
  linear).
- Bloco de condições comerciais: **prazo de execução, validade da proposta e
  forma de pagamento** (ex.: 50% na assinatura, 50% na conclusão).
- Preferência do cliente: versão **ilustrativa e enxuta** quando houver opções
  a comparar — desenho explicativo com etapas numeradas e cards lado a lado,
  em vez de tabelas cheias de informação técnica.

### 3.7 Quantitativo de materiais

- Planilha (xlsx) com quantidades por ambiente/local.
- Quando houver hipóteses construtivas a comparar, uma coluna ou aba por
  hipótese.
- Incluir materiais de assentamento (argamassa, rejunte) de **todos** os itens.
- Acréscimo de 10% de perda deve ficar explícito (valor com e sem).
- **Não** rotular itens como "opção 1/2" quando a escolha já foi decidida.
- Quando pedido, gerar duas versões de PDF: com e sem o desenho da elevação.

### 3.8 Pacote de dados para carga no app

Formato já validado: um `.md` com modelo de dados, regras de negócio e totais
de conferência + um `.sql` com os INSERTs. Ao final do `.md`, tabela de
conferência com os números que precisam bater após a carga.

---

## 4. Regras de conteúdo transversais

1. **Português do Brasil** em todos os rótulos e textos.
2. Toda tabela termina em linha de **TOTAL** com faixa navy.
3. Observações numeradas, em itálico, 9 pt, ao pé do documento.
4. Assinatura do responsável técnico encerra todo documento de cliente:
   `Rubens Veras Guimarães — RV Engenharia — Responsável Técnico`.
5. Nada de valor "provisório" no corpo do documento: se depende de decisão,
   vira observação.
6. Documentos de cliente não expõem custo interno nem margem.
7. Dados de contato da empresa (rodapé de materiais de divulgação):
   (86) 99437-9883 · rvengenhariathe@gmail.com · @rvengenhariathe ·
   Av. Zequinha Freire, 3531 — Teresina/PI.

---

## 5. Como validar o que o app gerar

Antes de considerar um relatório pronto, rodar estas conferências — foram
exatamente as que pegaram erros nesta obra:

1. **Contagem de páginas**: documento de rotina = 1 página + 1 por anexo.
2. **Extrair o texto do PDF** e conferir se a moeda saiu no padrão brasileiro
   (`R$ 67.029,64`, não `R$ 67,029.64`).
3. **Medir a centralização da logo** no render (delta ≤ 1 px), não a olho.
4. **Conferir os totais**: soma das linhas = total geral = soma dos grupos.
5. **Rótulos não quebrados**: procurar no texto extraído por palavras
   partidas ("RESPONS ÁVEL").
6. **Conteúdo dentro das margens**: nenhuma coluna cortada à direita.
7. **Recalcular as fórmulas** antes de exportar — planilha gerada por
   biblioteca não tem valores em cache; sem recálculo o PDF sai com células
   vazias ou zeradas.

---

## 6. Estado atual da obra de referência (Selecta Gil Martins)

Use como caso de teste ponta a ponta:

| Indicador | Valor |
|---|---|
| Valor total (mão de obra) | R$ 67.029,64 |
| Parcelas | 13 (12 × R$ 5.000,00 + balão de R$ 7.029,64) |
| Quitadas | 6 — 23/07, 01/08, 09/08, 15/08, 25/08 e 30/08/2026, todas via Pix |
| Total pago | R$ 30.000,00 |
| Saldo a pagar | R$ 37.029,64 |
| % quitado | 44,8% |
| Próximo vencimento | 05/09/2026 (parcela 7) |
| Comprovantes anexados | 5 (parcelas 2 a 6) |

Se o app gerar o cronograma desta obra e o resultado não for visualmente
igual ao PDF de referência, o desvio está no app — não no padrão.
