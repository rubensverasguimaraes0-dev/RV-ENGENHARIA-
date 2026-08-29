# Acervos — carregar no aplicativo o que já foi lançado no papel

Cada arquivo desta pasta é uma obra inteira, pronta para entrar no aplicativo de
uma vez só. É a ponte entre o controle antigo, feito em planilha, e o app: em vez
de redigitar semana por semana, cola-se o arquivo no SQL Editor do Supabase e a
obra aparece completa, com equipe, semanas fechadas, presenças e alimentação.

## Como carregar

1. Supabase → **SQL Editor** → **New query**
2. Abrir o arquivo da obra, copiar tudo, colar
3. **Run**

O resultado correto é `Success. No rows returned`. Logo abaixo aparece uma linha
de conferência com os totais — compare com a planilha de origem antes de seguir.

Rodar duas vezes não duplica nada: o script para sozinho, com uma mensagem clara,
se a obra já estiver no banco.

## O que já está aqui

| Arquivo | Obra | Período | Total |
| --- | --- | --- | --- |
| `selecta-gil-martins.sql` | Selecta – Gil Martins (padaria) | 20/07/2026 a 28/08/2026, semanas 1 a 6 | R$ 14.347,00 |

## Como um acervo é conferido antes de entrar aqui

Nenhum arquivo desta pasta é escrito à mão. Ele é gerado a partir da planilha e
depois **rodado contra um Postgres de verdade**, com o banco instalado pelo
`supabase/instalar.sql`. Só entra no repositório quando os números que saem do
banco batem, um a um, com os da planilha: total por funcionário, total por
semana, mão de obra, alimentação e quantidade de diárias.

No caso da Selecta, os números conferidos foram:

- 82 presenças, 81,5 diárias (a meia diária do Iago em 12/08 inclusa)
- mão de obra R$ 12.855,00
- 79 quentinhas, alimentação R$ 1.492,00
- total da obra R$ 14.347,00
- as seis semanas fecham exatamente como a aba *Resumo por Semana*

## Duas decisões que valem registro

**A semana vai de segunda a sábado.** Quando a obra parou antes, o dia entra como
*sem expediente* em vez de sumir — assim o relatório da semana não cobra dia
parado, e continua dando para ver que aquele dia existiu. Foi o caso da semana 5,
encerrada na quinta, e das cinco semanas encerradas na sexta.

**O valor da diária vai congelado em cada presença.** Aumentar a diária de um
funcionário no cadastro não pode reescrever o que já foi pago. Por isso o valor
do dia fica gravado no próprio lançamento, e o cadastro só vale daí para a frente.
