# Especificação — Relatórios de Despesa da Obra (RV Engenharia)

> Este documento é o "manual" para gerar os relatórios de despesa da obra
> exatamente no padrão validado ao longo do trabalho. Entregue este arquivo
> ao Claude Code junto com os dois scripts de referência
> (`gabarito_relatorio_completo.py` e `gabarito_resumo.py`). O objetivo é que
> qualquer relatório novo saia idêntico em layout, cores e regras.

---

## 1. Visão geral

Para **cada semana** de obra são gerados **dois PDFs**, e quando o cliente paga,
um **terceiro**:

1. **Resumo (1 página)** — para o cliente. Direto, com o total em destaque,
   uma tabela "onde foi aplicado" e a relação simples de despesas. No final,
   as fotos das notas anexadas.
2. **Relatório completo** — para controle interno. Traz resumo geral,
   distribuições (por fornecedor, por dia), detalhamento item a item de cada
   nota, observações técnicas e, ao final, o anexo com as fotos de todas as notas.
3. **Recibo de pagamento** — emitido só quando o cliente paga a semana, com o
   comprovante (Pix/depósito) anexado.

Cada semana é **contabilizada à parte**: os valores de uma semana nunca se
somam aos de outra, nem ao recibo. Isso fica dito por escrito em cada documento.

---

## 2. Identidade visual (fixa em todos os documentos)

- **Formato:** A4, margens de 17 mm (laterais), 15 mm (topo), 20 mm (base).
- **Fonte:** Helvetica (padrão do ReportLab), sem fontes externas.
- **Cores (hex):**
  - Azul principal (faixas, cabeçalhos de tabela, caixa de total): `#1F3864`
  - Azul claro (linha de total, realces): `#DCE3F0`
  - Cinza de fundo (rótulos, caixa de observação): `#F2F2F2`
  - Cinza de linha (grades de tabela): `#BFBFBF`
  - Cinza de texto secundário: `#595959` / `#404040`
  - Zebra de linhas (alternância): branco e `#F7F9FC`
  - Vermelho escuro (só para "pago pelo cliente / não repassar"): `#7F1D1D`
    com fundo `#FBE4E4`
- **Logo:** logo "RV" (azul/vermelho) com "engenharia" abaixo, no canto superior
  esquerdo. **Sempre achatada sobre fundo branco** (nunca com transparência que
  vire fundo preto no PDF). Tamanho ~26,5 × 18 mm no relatório completo e no
  recibo; ~23,6 × 16 mm no resumo. Ao lado direito da logo, alinhado à direita:
  **RV ENGENHARIA** / Estrutural • Construção • Reformas / Teresina – PI.
  Uma linha azul de 1,2 pt separa o cabeçalho do corpo.
- **Faixa de seção:** retângulo azul `#1F3864`, texto branco em Helvetica-Bold 10,5–11.
- **Rodapé:** linha cinza + à esquerda "RV Engenharia | ..." e à direita o número
  da página (nos relatórios) ou "Emitido em DD/MM/AAAA" (no resumo/recibo).

---

## 3. Formatação de valores

- Moeda no padrão brasileiro: `R$ 1.234,56` (milhar com ponto, decimal com vírgula).
- Datas: `DD/MM/AAAA`.
- Valor por extenso (só no recibo): ex. "mil quinhentos e trinta e seis reais".

---

## 4. Relatório completo — estrutura das seções

Na ordem:

1. **Cabeçalho** (logo + nome da empresa).
2. **Título:** "RELATÓRIO DE DESPESAS DE OBRA – SEMANA N".
3. **Subtítulo:** "Obra: Padaria Selecta – Av. Gil Martins, 3144 – Bairro Três
   Andares – Teresina/PI".
4. **Quadro de identificação** (tabela 4 colunas, rótulos em cinza): Obra,
   Endereço, Cliente, Resp. técnico | Período, Nº de docs., Emissão, Total geral.
5. **Nota em itálico** logo abaixo: diz que a semana é contabilizada à parte e
   que todas as notas foram adiantadas pela RV (a repassar) — salvo exceção do
   item 7.
6. **Seção 1 – Resumo geral:** tabela com Nº, Data, Dia, Fornecedor, Categoria,
   Valor. Última linha = TOTAL GERAL (fundo azul-claro).
7. **Seção 2 – Distribuição por fornecedor:** Fornecedor, Docs., Valor, % do total.
8. **Seção 3 – Distribuição por dia:** Dia, Data, Docs., Valor.
   (Quando há poucas notas, pode-se omitir a distribuição por dia — usar bom senso.)
9. **Seção — Detalhamento dos documentos:** para cada nota, um bloco com:
   - Cabeçalho azul-claro: "DOCUMENTO NN – Fornecedor" + valor à direita.
   - Linha de info: Data (dia da semana), Documento (nº da NF/pedido), Categoria.
   - Tabela de itens: Descrição, Qtd., V. unit., V. total. Última linha = Subtotal.
   - Cada bloco é mantido junto (não quebra no meio da página).
10. **Seção — Observações técnicas:** bullets em prosa justificada. Sempre incluir:
    contabilização separada; explicação de descontos e arredondamentos; notas
    manuscritas vs. fiscais; e "Anexos" avisando que as fotos vêm ao final.
11. **Caixa de total geral** (faixa azul grande com o valor).
12. **Assinaturas:** Rubens Veras Guimarães (Engenheiro Responsável – RV
    Engenharia) e Romulo Veras (Cliente / Contratante).
13. **Quebra de página → Anexo:** faixa "ANEXO – COMPROVANTES (FOTOS DAS NOTAS)"
    e as fotos em **grade de 2 colunas**, cada foto com legenda
    "Documento NN – Fornecedor / Data (Dia) – Valor".

---

## 5. Resumo (1 página) — estrutura

1. Cabeçalho (logo).
2. Título: "RESUMO DE DESPESAS DA OBRA – SEMANA N".
3. Subtítulo com endereço + "Período de DD/MM/AAAA a DD/MM/AAAA".
4. **Caixa de total** em destaque (faixa azul, valor grande à direita).
5. **ONDE FOI APLICADO:** tabela Natureza da despesa, Valor, %. Poucas linhas
   (2–3 grupos), agrupando as categorias.
6. **RELAÇÃO DE DESPESAS:** Data, Dia, Fornecedor, Descrição (linguagem simples,
   sem jargão técnico nem nº de NF), Valor. Última linha = TOTAL GERAL.
7. **Caixa cinza** com a observação (nº de documentos, semana à parte, fotos
   anexadas).
8. Assinaturas (Rubens / Romulo).
9. Quebra de página → Anexo com as fotos, mesma grade de 2 colunas do relatório.

**Importante:** o resumo é enxuto e "para o cliente entender sem se confundir".
Não repetir números de documento fiscal, categorias técnicas, divergências de
arredondamento nem cláusulas de contrato — isso fica só no relatório completo.

---

## 6. Recibo de pagamento — estrutura

1. Cabeçalho (logo).
2. Título "RECIBO DE PAGAMENTO" + subtítulo com a obra e "Despesas da semana N
   (período)".
3. **Caixa "VALOR RECEBIDO"** (faixa azul, valor grande).
4. **Parágrafo declaratório:** "Declaro, para os devidos fins, que recebi de
   Romulo Veras (cliente contratante), por meio da empresa Selecta Padaria, a
   importância de R$ X (valor por extenso), por meio de transferência bancária
   (Pix)/depósito em conta, referente ao pagamento das despesas da obra da
   Padaria Selecta (semana N, período), situada na Av. Gil Martins, 3144 –
   Bairro Três Andares, Teresina/PI."
5. **DADOS DO RECEBIMENTO** (tabela rótulo/valor): Recebedor (favorecido),
   Pagador, Forma de pagamento, Instituição de destino, Chave Pix / conta,
   Instituição de origem, ID da transação / nº de controle, Data da operação,
   Referência, Valor total recebido.
6. **Caixa cinza** com observação de quitação + "comprovante anexo a este recibo".
7. Local e data + assinatura do recebedor (Rubens).
8. Quebra de página → Anexo "COMPROVANTE DE TRANSFERÊNCIA (PIX)" com a imagem do
   comprovante centralizada.

Dados bancários usados nos recibos (favorecido Rubens Veras Guimarães):
- Já usados: Caixa Econômica Federal (Ag. 2004 / conta 780680927-0) e
  Nu Pagamentos (chave e-mail), e Banco C6 (chave Pix telefone +55 86 9 9827-8777).
- O pagador costuma ser "Selecta Padaria" (Nu Pagamentos). Confirmar sempre
  banco/chave/ID no comprovante que o cliente enviar.

---

## 7. Regras de negócio (muito importantes)

1. **Cada semana é isolada.** Nunca somar semanas entre si nem com recibos.
2. **Fechar sempre com o total impresso na nota.** Quando a soma dos itens
   diverge do total (desconto de balcão, arredondamento), lançar uma linha
   própria: "Desconto concedido (X%)" ou "Arredondamento", com valor negativo,
   para o subtotal bater exatamente com o total escrito na nota.
3. **Valor unitário ausente:** quando a nota traz só o total da linha, calcular
   o unitário por divisão (total ÷ quantidade) e registrar isso nas observações.
4. **Notas pagas diretamente pelo cliente na loja** (não adiantadas pela RV):
   entram no relatório em **seção separada**, marcadas em vermelho escuro
   (`#7F1D1D` / fundo `#FBE4E4`) como "PAGO PELO CLIENTE – NÃO INTEGRA O VALOR A
   REPASSAR". Nesses casos o documento mostra **dois totais distintos**:
   "Valor a repassar à RV" (azul) e "Pago diretamente pelo cliente" (vermelho).
   No resumo, a linha da compra do cliente aparece fora do subtotal a repassar,
   também em vermelho.
5. **Sempre anexar as fotos das notas ao final** de ambos os documentos (resumo
   e completo), em grade de 2 colunas, na mesma ordem/numeração das notas.
6. **Confirmar antes de fechar:** datas fora do período da semana, valores
   manuscritos ilegíveis e itens ambíguos devem ser confirmados com o usuário
   antes de gerar. Descrições de NFC-e podem ser padronizadas em linguagem clara.
7. **Fotos:** reorientar as que vierem deitadas/de cabeça para baixo; comprimir
   para ~1400 px no maior lado, qualidade ~74. Recortar margens quando ajudar a
   leitura (ex.: comprovante Pix com tarjas pretas).

---

## 8. Dados fixos da empresa e da obra

- **Empresa:** RV Engenharia — Estrutural • Construção • Reformas — Teresina/PI.
- **Responsável técnico:** Rubens Veras Guimarães (Engenheiro).
- **Obra:** Padaria Selecta — Av. Gil Martins, 3144 (em frente ao Unipop) —
  Bairro Três Andares — Teresina/PI.
- **Cliente / contratante:** Romulo Veras.

---

## 9. Como usar os gabaritos

Os dois arquivos Python entregues junto são **funcionais** e produzem os PDFs
no padrão descrito. Para uma semana nova, basta:

1. Editar a lista `notas` (relatório) / `itens` (resumo) com os dados da semana.
2. Trocar os textos de título, período, emissão e o caminho de saída do PDF.
3. Apontar os caminhos das fotos (`fotos/sN_XX.jpg`) e da logo (`logo.png`).
4. Rodar. Conferir o PDF antes de entregar.

O formato de cada nota na lista `notas` é:

```
("NN", "DD/MM/AAAA", "DiaDaSemana", "Fornecedor",
 "Documento (nº NF / pedido)",
 [ (descrição, qtd_texto, valor_unitário_ou_None, valor_total), ... ],
 "Categoria", "fotos/sN_XX.jpg")
```

Use `None` no valor unitário quando não se aplica (ex.: linha de desconto),
e valores negativos para descontos/arredondamentos.

---

## 10. Dependências

- Python 3 + ReportLab (`pip install reportlab`).
- Pillow (`pip install pillow`) para preparar/rotacionar/comprimir as fotos.
- Poppler (`pdftoppm`) opcional, só para conferência visual.
