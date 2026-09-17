# ATUALIZAÇÃO DE DADOS E REGRAS — obra Selecta – Gil Martins
**Posição em: quinta-feira, 17/09/2026 (semana 9 em andamento)**
**Para:** Claude Code — atualizar o app de controle de diárias

Este documento acompanha `referencia/dados/obra_selecta.json` (44 lançamentos, 20/07 a 17/09). O JSON é a fonte da verdade; este texto explica o que mudou e dá os números para conferência.

---

## 1. O que mudou desde o kit anterior

### 1.1 Novos campos no lançamento diário

**`extras`** — outros consumos do dia, lista de `{descricao, qtd, valor}`. Em uso:
- `Gelo` — a partir de 08/09. Quantidade e preço **variam por dia** (2 × R$ 6,00; 1 × R$ 5,00; 1 × R$ 7,00). Nunca fixar.
- `Entrega de quentinhas` — R$ 10,00 por entrega, quando o fornecedor entrega na obra (10/09 e 11/09).

**`bonus`** — bônus de produção pago no dia em que um serviço por produção é concluído:
```json
"bonus": {"descricao": "Bônus de produção — revestimento 110 m² concluído em 3 dias (2 diárias por pessoa)",
          "diarias": {"Thiago": 2, "Francisco": 2, "Rufino": 2, "Carlos": 2}}
```
Valor de cada bônus = diárias × diária cheia do funcionário. Entra em **mão de obra**, em linha separada, no dia da conclusão. Não conta como presença.

### 1.2 Novas regras de negócio
1. **Feriado com expediente até meio-dia** (07/09): diária integral, sem quentinha — igual ao sábado.
2. **Acordo por produção**: a equipe recebe a semana inteira se concluir o serviço antes da sexta. Quando conclui, os dias restantes viram bônus (item acima). Se a equipe vier nesses dias para outra frente, os dias entram como presença normal, por fora — ou seja, a pessoa pode ter mais de 5 diárias na semana (ex.: 5 presenças + 2 de bônus).
3. **Alimentação e outros** = quentinhas + extras. É essa a coluna que aparece nos totais e no acumulado.
4. **Relatório parcial**: o app deve conseguir gerar o relatório de uma semana em andamento, marcado como PARCIAL no título (`--parcial` no gerador de referência).
5. **Uma página, sempre**: o gerador reduz altura de linha e fonte (fator `k`) quando a semana é grande. O app deve fazer o mesmo, nunca criar uma segunda página.

### 1.3 Equipe — situação atual
| Funcionário | Função | Diária | Situação |
|---|---|---|---|
| Thiago | Pedreiro | R$ 200,00 | Ativo desde 20/07 |
| Wiliton | Eletricista | R$ 200,00 | Ativo; presença intermitente (outro serviço nos dias em que não aparece) |
| Francisco | Pedreiro | R$ 160,00 | Ativo desde 08/09 |
| Rufino | Servente | R$ 100,00 | Ativo desde 08/09 |
| Carlos | Servente | R$ 100,00 | Ativo desde 08/09 |
| Máximo | Ajudante | R$ 100,00 | Ativo; última presença 04/09 |
| Amigo Máximo | Ajudante | R$ 100,00 | Ativo; última presença 25/07 |
| Rafael | Eletricista | R$ 200,00 | Ativo; última presença 11/08 |
| Iago | Servente | R$ 90,00 | Ativo; última presença 20/08 |
| Gervasio | Ajudante | R$ 90,00 | Desligado em 29/07 |
| Wellington | Servente | R$ 90,00 | Desligado em 03/08 |
| Roberto Júnior | Servente | R$ 90,00 | Desligado em 03/08 |
| Eduardo | Servente | R$ 90,00 | Desligado em 07/08 |

---

## 2. Semana 9 (em andamento) — dia a dia

| Dia | Presenças | Quentinhas | Gelo | Bônus | Total |
|---|---|---|---|---|---|
| Seg 14/09 | Thiago, Francisco, Rufino, Carlos | 4 × R$ 18 | 1 × R$ 5 | — | R$ 637,00 |
| Ter 15/09 | + Wiliton (5) | 5 × R$ 18 | 1 × R$ 7 | — | R$ 857,00 |
| Qua 16/09 | os 5 | 5 × R$ 18 | 1 × R$ 7 | 4 × 2 diárias = R$ 1.120,00 | R$ 1.977,00 |
| Qui 17/09 | os 5 | 5 × R$ 18 | 1 × R$ 5 | — | R$ 855,00 |
| **Parcial** | **19 diárias + 8 bônus** | **19 un. · R$ 342,00** | **R$ 24,00** | **R$ 1.120,00** | **R$ 4.326,00** |

Mão de obra parcial: R$ 3.960,00 (R$ 2.840,00 de presenças + R$ 1.120,00 de bônus).
Por funcionário até quinta: Thiago R$ 1.200 (4 + 2 bônus) · Francisco R$ 960 (4 + 2) · Rufino R$ 600 (4 + 2) · Carlos R$ 600 (4 + 2) · Wiliton R$ 600 (3).

Serviço por produção: revestimento cerâmico 70×70, ~110 m², concluído em 3 dias (14 a 16/09). Custo apurado: R$ 2.800,00 de mão de obra + R$ 235,00 de alimentação da equipe = **R$ 3.035,00 → R$ 27,59/m²**.

---

## 3. Semana 8 (fechada) — dia a dia

| Dia | Presenças | Quentinhas | Gelo | Entrega | Total |
|---|---|---|---|---|---|
| Seg 07/09 (feriado) | Thiago, até meio-dia | 0 | — | — | R$ 200,00 |
| Ter 08/09 | Thiago, Francisco, Rufino, Carlos | 4 × R$ 18 | 2 × R$ 6 | — | R$ 644,00 |
| Qua 09/09 | os 4 | 4 × R$ 18 | 2 × R$ 6 | — | R$ 644,00 |
| Qui 10/09 | os 4 | 4 × R$ 18 | 2 × R$ 6 | R$ 10 | R$ 654,00 |
| Sex 11/09 | os 4 | 4 × R$ 18 | 2 × R$ 6 | R$ 10 | R$ 654,00 |
| **Total** | **17 diárias** | **16 un. · R$ 288,00** | **R$ 48,00** | **R$ 20,00** | **R$ 2.796,00** |

---

## 4. Conferência — todas as semanas

| Semana | Período | Diárias | Bônus | M.O. | Quent. | Alim. e outros | Total |
|---|---|---|---|---|---|---|---|
| 1 | 20 a 25/07 | 16 | — | R$ 2.340,00 | 12 | R$ 264,00 | R$ 2.604,00 |
| 2 | 27 a 31/07 | 19 | — | R$ 2.370,00 | 19 | R$ 334,00 | R$ 2.704,00 |
| 3 | 03 a 07/08 | 14 | — | R$ 2.360,00 | 14 | R$ 246,00 | R$ 2.606,00 |
| 4 | 10 a 14/08 | 11,5 | — | R$ 2.025,00 | 13 | R$ 246,00 | R$ 2.271,00 |
| 5 | 17 a 20/08 | 12 | — | R$ 1.960,00 | 12 | R$ 216,00 | R$ 2.176,00 |
| 6 | 24 a 28/08 | 9 | — | R$ 1.800,00 | 9 | R$ 186,00 | R$ 1.986,00 |
| 7 | 31/08 a 04/09 | 10 | — | R$ 1.700,00 | 10 | R$ 188,00 | R$ 1.888,00 |
| 8 | 07 a 11/09 | 17 | — | R$ 2.440,00 | 16 | R$ 356,00 | R$ 2.796,00 |
| 9 (parcial) | 14 a 17/09 | 19 | 8 | R$ 3.960,00 | 19 | R$ 366,00 | R$ 4.326,00 |
| **Acumulado** | | **127,5** | **8** | **R$ 20.955,00** | **124** | **R$ 2.402,00** | **R$ 23.357,00** |

Mensal: Julho R$ 5.308,00 · Agosto R$ 9.483,00 · Setembro (até 17/09) R$ 8.566,00.

Se o app produzir qualquer número diferente com o mesmo JSON, o cálculo está errado.

---

## 5. Mensagem sugerida para o Claude Code

> Leia ATUALIZACAO_17-09.md e substitua `referencia/dados/obra_selecta.json` pela versão nova. Há dois campos novos no lançamento (`extras` e `bonus`) e a regra de relatório parcial — o gerador `referencia/relatorio_semanal.py` já implementa tudo; use-o como referência. Atualize o modelo de dados do app (tabela de extras do dia e tabela de bônus), importe os 44 lançamentos e gere o relatório da semana 9 marcado como parcial. Compare com `referencia/exemplos/Resumo_Semanal_Selecta_14-09-a-17-09.pdf` e me mostre as diferenças antes de ajustar.
