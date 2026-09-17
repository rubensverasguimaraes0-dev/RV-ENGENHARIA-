# Especificação — App de Controle de Diárias de Obra

**Cliente:** RV Engenharia — Rubens Veras Guimarães (Eng. Civil, CREA-PI 35900), Teresina/PI
**Documento para:** Claude Code
**Objetivo:** construir um aplicativo web (PWA) para lançamento diário de presença e custos de mão de obra em obras, com fechamento semanal automático e geração de relatório em PDF.

---

## 1. Contexto

Hoje esse controle é feito manualmente, em planilha, obra por obra e semana por semana. O responsável lança, ao final de cada dia, quem trabalhou e quantas quentinhas (marmitas) foram compradas. Ao final da semana, precisa de um relatório fechado com custo por dia, custo por funcionário e custo total.

O app deve substituir esse trabalho manual. **Quem vai usar é engenheiro, não programador** — a interface precisa ser simples o bastante para o lançamento do dia levar menos de 30 segundos, no celular, muitas vezes em pé no canteiro.

---

## 2. Decisões já tomadas

| Item | Decisão |
|---|---|
| Tipo de aplicação | Web app instalável (PWA), não app de loja |
| Acesso | De qualquer aparelho — celular, tablet, computador |
| Dados | Nuvem, com login |
| Idioma | Português do Brasil |
| Moeda | Real (R$), formato `R$ 1.234,56` |
| Datas | `DD/MM/AAAA` |

### Stack sugerida

- **Front-end:** Next.js (App Router) + React + TypeScript + Tailwind
- **Banco e autenticação:** Supabase (Postgres + Auth), plano gratuito atende
- **Hospedagem:** Vercel, plano gratuito
- **PDF:** geração no servidor (por exemplo `@react-pdf/renderer` ou Puppeteer)
- **PWA:** manifest + service worker, com cache para funcionar mesmo com internet fraca no canteiro

Se você julgar outra stack melhor, pode propor — mas mantenha: hospedagem gratuita ou barata, banco gerenciado, e nada que exija o usuário rodar comandos no dia a dia.

---

## 3. Modelo de dados

### `obras`
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | |
| nome | texto | ex.: "Selecta – Gil Martins" |
| endereco | texto | aparece no cabeçalho do relatório |
| data_inicio | data | |
| data_fim | data | nulo enquanto em andamento |
| ativa | booleano | |

### `funcionarios`
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | |
| obra_id | uuid | |
| nome | texto | |
| funcao | texto | Pedreiro, Eletricista, Servente, Ajudante |
| valor_diaria | decimal | valor cheio da diária |
| data_entrada | data | |
| data_saida | data | nulo se ativo |
| status | enum | `ativo`, `desligado` |

**Importante:** o valor da diária pode mudar ao longo da obra. Guarde histórico (tabela `funcionarios_diarias` com `funcionario_id`, `valor`, `vigencia_inicio`) ou, no mínimo, congele o valor usado em cada lançamento. Um relatório antigo nunca pode mudar porque a diária foi reajustada depois.

### `lancamentos_dia`
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | |
| obra_id | uuid | |
| data | data | única por obra |
| quentinhas_qtd | inteiro | pode ser 0 |
| quentinhas_valor_unitario | decimal | **lançado por dia, não fixo** |
| observacao | texto | livre |

### `presencas`
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | |
| lancamento_dia_id | uuid | |
| funcionario_id | uuid | |
| fator | decimal | `1` = diária inteira, `0.5` = meia diária |
| valor_diaria_aplicado | decimal | congelado no momento do lançamento |

---

## 4. Regras de negócio

Estas regras vêm de seis semanas de operação real. Elas não são hipotéticas — cada uma apareceu na prática.

### 4.1 Presença
- `fator = 1` → diária inteira. `fator = 0,5` → meia diária. Sem registro → não trabalhou.
- Meia diária acontece, por exemplo, quando o funcionário chega fora do horário no primeiro dia. Caso real: servente com diária de R$ 90,00 cumpriu meio expediente e recebeu R$ 45,00.
- **Sábado até meio-dia é pago como diária integral.** Não é meia diária. Nesses dias normalmente não há fornecimento de quentinha.

### 4.2 Quentinhas (alimentação)
- O valor unitário **muda de dia para dia** conforme o fornecedor. Valores já praticados na mesma obra: R$ 15,00, R$ 18,00 e R$ 22,00.
- Já houve troca definitiva de fornecedor (de R$ 22 para R$ 15, depois para R$ 18) e também compra avulsa a preço maior porque o fornecedor habitual não tinha (dia isolado a R$ 22 no meio de uma semana de R$ 18).
- Por isso o campo é **por lançamento diário**, nunca uma configuração global da obra.
- A quantidade **não é derivada da presença**. Normalmente é uma por funcionário, mas o responsável pela obra às vezes compra uma a mais para si. Caso real: 4 quentinhas para 3 funcionários. O app deve sugerir a quantidade igual ao número de presentes, mas permitir alterar livremente, sem alerta de erro.
- Em dias sem almoço, a quantidade é 0.

### 4.3 Entrada e saída de funcionários
- Funcionários entram e saem no meio da obra, com frequência.
- **Falta não é desligamento.** Um funcionário pode não aparecer por estar alocado em outro serviço e continuar ativo.
- Um funcionário desligado precisa continuar existindo no histórico, com as diárias que já recebeu.

### 4.4 Fechamento semanal
- A semana vai de segunda a sábado, mas **frequentemente termina antes**: já houve semana encerrada na sexta e semana encerrada na quinta.
- O relatório fecha nos dias que efetivamente tiveram lançamento. Não inclua dias vazios.
- **No relatório da semana, só aparecem os funcionários que tiveram pelo menos uma presença naquela semana.** Quem ficou zerado não deve aparecer nem nas telas de dia nem nos resumos daquele relatório — isso foi pedido explicitamente. Ele continua no cadastro e volta a aparecer na semana em que trabalhar.
- Correções retroativas acontecem: já foi preciso refazer uma sexta-feira inteira depois de fechada. O app precisa permitir editar qualquer dia e recalcular tudo automaticamente.

---

## 5. Telas

### 5.1 Lançamento do dia (tela principal)
Essa é a tela que será usada todo dia. Prioridade máxima de simplicidade.

- Seletor de obra (se houver mais de uma ativa) e de data, com padrão na data de hoje.
- Lista dos funcionários ativos da obra, cada um com um controle de três estados: **inteira / meia / ausente**. Um toque, sem menu suspenso.
- Botão "repetir presença de ontem" — na prática, a maioria dos dias repete o dia anterior.
- Campo de quentinhas: quantidade (já preenchida com o número de presentes) e valor unitário (já preenchido com o último valor usado).
- Campo de observação, opcional.
- Rodapé fixo mostrando, em tempo real: total de diárias, custo de mão de obra, custo de alimentação e **total do dia** em destaque.

### 5.2 Equipe
Cadastro de funcionários: nome, função, valor da diária, data de entrada. Ações de desligar e reativar. Nunca excluir de verdade — só marcar como desligado.

### 5.3 Semana
Lista dos dias lançados na semana corrente, com o total de cada dia e o acumulado. Botão para gerar o relatório.

### 5.4 Histórico
Semanas já fechadas, com o total de cada uma e o acumulado da obra. Acesso aos PDFs já gerados.

---

## 6. Relatório semanal (PDF)

Este é o entregável final e precisa sair **em uma única página, A4 paisagem**.

### Estrutura
1. **Cabeçalho:** faixa azul-escuro com o título "CONTROLE DE DIÁRIAS E CUSTOS DE MÃO DE OBRA — SEMANA DD/MM A DD/MM/AAAA", nome e endereço da obra, e "RV ENGENHARIA" à direita.
2. **Blocos de dia:** grade de 3 colunas. Um bloco por dia lançado, contendo a tabela de funcionários (nome, função, diárias, valor), o subtotal de mão de obra, a linha de quentinhas (`X un. × R$ Y`) e uma faixa verde com o **TOTAL DO DIA**. Observações do dia aparecem em vermelho, em fonte menor, dentro do bloco.
3. **Card de observações/alterações da semana:** ocupa os espaços de bloco que sobrarem na grade. Lista datada das mudanças — entradas, saídas, troca de fornecedor, quentinha extra, dias sem expediente.
4. **Gastos por funcionário:** tabela com funcionário, função, valor da diária, diárias na semana e total a pagar, mais linha de total.
5. **Quentinhas separadas por valor unitário:** uma linha para cada preço praticado, com os dias em que foi usado, a quantidade e o custo. Depois, o total. **Essa separação foi pedida explicitamente e é obrigatória em todo relatório**, mesmo quando só houve um preço na semana.
6. **Gasto geral da semana:** mão de obra + alimentação, com o total em caixa verde destacada.
7. **Acumulado da obra:** uma linha por semana já fechada e o total acumulado.
8. **Rodapé:** "RV Engenharia · Resp. téc. Rubens Veras Guimarães · Valores de diária e quentinha conforme informado pela obra · Emitido em DD/MM/AAAA".

### Identidade visual
- Azul institucional `#1F3864` nas faixas e títulos; azul claro `#D9E1F2` nas barras de seção; cinza `#F2F2F2` nos subtotais; verde `#C6E0B4` nos totais.
- Fonte sem serifa, tamanhos entre 6,5 e 14 pt.
- Denso e colorido, com tabelas bem delimitadas. **Não** usar layout minimalista com muito espaço em branco.
- **Não** colocar o valor total em fonte muito grande.
- Há uma logo da RV Engenharia (letras "RV" em azul e vermelho, com "engenharia" abaixo) que o usuário fornecerá. Deixe o cabeçalho preparado para recebê-la.

### Exportação adicional
Gerar também a planilha `.xlsx` da semana, com uma aba por dia (mão de obra detalhada, quentinhas e resumo do dia) mais uma aba de resumo semanal. Isso é desejável, não bloqueante — priorize o PDF.

---

## 7. Casos de teste

Use estes dados reais para validar os cálculos. Todos vêm da obra Selecta – Gil Martins.

### Semana 1 — 20/07 a 25/07/2026
Equipe: Thiago (Pedreiro, 200), Wiliton (Eletricista, 200), Gervasio (Ajudante, 90), Máximo (Ajudante, 100), Amigo Máximo (Ajudante, 100). Quentinha: R$ 22,00.

| Dia | Presenças | Quentinhas | Total do dia |
|---|---|---|---|
| Seg 20 | Thiago, Gervasio | 2 | R$ 334,00 |
| Ter 21 | Thiago, Gervasio | 2 | R$ 334,00 |
| Qua 22 | Thiago, Gervasio | 2 | R$ 334,00 |
| Qui 23 | Thiago, Gervasio, Wiliton | 3 | R$ 556,00 |
| Sex 24 | Thiago, Gervasio, Wiliton | 3 | R$ 556,00 |
| Sáb 25 | Thiago, Gervasio, Máximo, Amigo Máximo | 0 | R$ 490,00 |

Esperado: 16 diárias · M.O. R$ 2.340,00 · 12 quentinhas · alimentação R$ 264,00 · **total R$ 2.604,00**.
Por funcionário: Thiago 1.200 · Gervasio 540 · Wiliton 400 · Máximo 100 · Amigo Máximo 100.
*Testa: sábado com diária integral e sem quentinha.*

### Semana 2 — 27/07 a 31/07/2026
| Dia | Presenças | Quentinhas | Total |
|---|---|---|---|
| Seg 27 | Thiago, Wiliton, Gervasio | 3 × R$ 22 | R$ 556,00 |
| Ter 28 | Thiago, Gervasio, Wellington, Roberto Júnior | 4 × R$ 22 | R$ 558,00 |
| Qua 29 | Thiago, Eduardo, Wellington, Roberto Júnior | 4 × R$ 15 | R$ 530,00 |
| Qui 30 | Thiago, Eduardo, Wellington, Roberto Júnior | 4 × R$ 15 | R$ 530,00 |
| Sex 31 | Thiago, Eduardo, Wellington, Roberto Júnior | 4 × R$ 15 | R$ 530,00 |

Wellington, Roberto Júnior e Eduardo são serventes de R$ 90,00. Gervasio foi desligado em 29/07.
Esperado: 19 diárias · M.O. R$ 2.370,00 · 19 quentinhas · alimentação R$ 334,00 · **total R$ 2.704,00**.
Quentinhas por valor: 7 un. a R$ 22 (R$ 154) + 12 un. a R$ 15 (R$ 180).
*Testa: entrada de funcionários no meio da semana, desligamento e troca de preço da quentinha.*

### Semana 3 — 03/08 a 07/08/2026
| Dia | Presenças | Quentinhas | Total |
|---|---|---|---|
| Seg 03 | Thiago, Wiliton, Eduardo | 3 × R$ 15 | R$ 535,00 |
| Ter 04 | Thiago, Wiliton, Eduardo | 3 × R$ 22 | R$ 556,00 |
| Qua 05 | Thiago, Wiliton, Eduardo | 3 × R$ 15 | R$ 535,00 |
| Qui 06 | Thiago, Wiliton, Eduardo | 3 × R$ 18 | R$ 544,00 |
| Sex 07 | Thiago, Wiliton | 2 × R$ 18 | R$ 436,00 |

Esperado: 14 diárias · M.O. R$ 2.360,00 · 14 quentinhas · alimentação R$ 246,00 · **total R$ 2.606,00**.
Quentinhas por valor: 6 a R$ 15 (R$ 90) + 5 a R$ 18 (R$ 90) + 3 a R$ 22 (R$ 66).
*Testa: três preços diferentes na mesma semana, incluindo compra avulsa isolada.*

### Semana 4 — 10/08 a 14/08/2026
| Dia | Presenças | Quentinhas | Total |
|---|---|---|---|
| Seg 10 | Thiago, Wiliton | 2 × R$ 18 | R$ 436,00 |
| Ter 11 | Thiago, Wiliton, Rafael | **4** × R$ 18 | R$ 672,00 |
| Qua 12 | Thiago, **Iago (0,5)** | 2 × R$ 18 | R$ 281,00 |
| Qui 13 | Thiago, Iago | 2 × R$ 18 | R$ 326,00 |
| Sex 14 | Thiago, Wiliton, Iago | 3 × R$ 22 | R$ 556,00 |

Rafael: eletricista, R$ 200. Iago: servente, R$ 90.
Esperado: 11,5 diárias · M.O. R$ 2.025,00 · 13 quentinhas · alimentação R$ 246,00 · **total R$ 2.271,00**.
*Testa: meia diária, quentinha extra além do número de presentes, e correção retroativa (esta sexta foi refeita depois de fechada).*

### Semana 5 — 17/08 a 20/08/2026
Quatro dias iguais: Thiago, Wiliton e Iago, 3 quentinhas a R$ 18,00 por dia. Total de cada dia: R$ 544,00.
Esperado: 12 diárias · M.O. R$ 1.960,00 · 12 quentinhas · alimentação R$ 216,00 · **total R$ 2.176,00**.
Rafael estava ativo mas sem nenhuma presença — **não deve aparecer no relatório desta semana**.
*Testa: semana encerrada na quinta e omissão de funcionário sem presença.*

### Acumulado após 5 semanas
72,5 diárias · M.O. R$ 11.055,00 · 70 quentinhas · alimentação R$ 1.306,00 · **total R$ 12.361,00**.

---

## 8. Roteiro de construção

Construa em fases, entregando algo utilizável em cada uma.

1. **Fase 1 — núcleo.** Login, cadastro de obra e equipe, tela de lançamento do dia com cálculo em tempo real. Sem relatórios ainda. Já dá para o usuário parar de anotar no papel.
2. **Fase 2 — fechamento.** Tela da semana, cálculos de resumo (por dia, por funcionário, quentinhas por valor) e o PDF de uma página.
3. **Fase 3 — histórico e acumulado.** Semanas anteriores, acumulado da obra, edição retroativa com recálculo.
4. **Fase 4 — refinos.** PWA instalável, funcionamento offline com sincronização, exportação em `.xlsx`, logo da empresa, múltiplas obras simultâneas.

Ao final de cada fase, rode os casos de teste da seção 7 e confira os totais antes de seguir.

---

## 9. O que evitar

- Fixar o valor da quentinha como configuração da obra.
- Calcular a quantidade de quentinhas automaticamente sem permitir edição.
- Impedir o lançamento de quentinhas em número diferente do de presentes.
- Excluir funcionários do banco em vez de marcá-los como desligados.
- Deixar que reajustes de diária alterem relatórios já emitidos.
- Exigir mais de três toques para lançar um dia comum.
- Relatório com mais de uma página.
