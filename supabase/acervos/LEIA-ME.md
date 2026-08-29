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

A Selecta – Gil Martins vem em dois arquivos, e **a ordem importa**: o primeiro
cria a obra, o segundo depende dela existir.

| Ordem | Arquivo | O que traz |
| --- | --- | --- |
| 1º | `selecta-gil-martins.sql` | O custo: equipe, 6 semanas fechadas, 82 presenças e alimentação — R$ 14.347,00 |
| 2º | `selecta-gil-martins-cronograma.sql` | A receita: contrato de empreitada, orçamento por grupos e as 13 parcelas — R$ 67.029,64 |

Rodados na ordem, os dois juntos deixam a tela de **Resultado** da obra
completa: R$ 67.029,64 contratados de um lado, o custo real do outro. Se você
rodar o segundo antes do primeiro, ele para e diz isso.

## Como um acervo é conferido antes de entrar aqui

Nenhum arquivo desta pasta é escrito à mão. Ele é gerado a partir da planilha e
depois **rodado contra um Postgres de verdade**, com o banco instalado pelo
`supabase/instalar.sql`. Só entra no repositório quando os números que saem do
banco batem, um a um, com os da planilha: total por funcionário, total por
semana, mão de obra, alimentação e quantidade de diárias.

No caso da Selecta, os números conferidos foram:

**Custo** — 82 presenças, 81,5 diárias (a meia diária do Iago em 12/08 inclusa),
mão de obra R$ 12.855,00, 79 quentinhas, alimentação R$ 1.492,00, total
R$ 14.347,00. As seis semanas fecham exatamente como a aba *Resumo por Semana*.

**Receita** — contrato R$ 67.029,64, orçamento somando os mesmos R$ 67.029,64,
13 parcelas somando R$ 67.029,64, 4 quitadas somando R$ 20.000,00, saldo
R$ 47.029,64, 29,8% quitado, próximo vencimento 22/08/2026.

## Duas decisões que valem registro

**A semana vai de segunda a sábado.** Quando a obra parou antes, o dia entra como
*sem expediente* em vez de sumir — assim o relatório da semana não cobra dia
parado, e continua dando para ver que aquele dia existiu. Foi o caso da semana 5,
encerrada na quinta, e das cinco semanas encerradas na sexta.

**O valor da diária vai congelado em cada presença.** Aumentar a diária de um
funcionário no cadastro não pode reescrever o que já foi pago. Por isso o valor
do dia fica gravado no próprio lançamento, e o cadastro só vale daí para a frente.

**O orçamento entrou com BDI e margem zerados.** Não porque a RV trabalhe sem
margem, mas porque os valores do documento são o preço já fechado com o cliente.
Arbitrar um BDI aqui mudaria o preço acordado. Quando o detalhe item a item
subir, com custo de material e de mão de obra por composição, a margem passa a
ser calculada em vez de suposta.

**Os terceirizados aparecem e não somam.** Forro drywall, marmoraria,
ar-condicionado e metalurgia são cotados à parte. Entraram como item *a cotar
separadamente*, que o aplicativo descreve no documento e deixa fora do total —
somá-los inflaria o contrato em cima de valores que ninguém fechou.

**Os comprovantes ficaram como texto, não como imagem.** Os arquivos
`IMG_2510.PNG`, `IMG_2617.PNG` e `IMG_2768.PNG` não vieram junto. Instituição,
horário, pagador e identificador de cada Pix estão gravados na observação da
parcela; para anexar as imagens, use Obras → Pagamentos → anexar comprovante,
que é o caminho que guarda o arquivo e faz ele sair no PDF do cronograma.
