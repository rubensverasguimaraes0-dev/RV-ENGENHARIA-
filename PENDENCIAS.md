# Pendências

Os catorze itens da ordem de construção da especificação estão entregues, e o código está
verificado: lint limpo, TypeScript sem erro, 246 testes passando, build compilando as 50 rotas e
`npm audit --omit=dev` sem vulnerabilidade. Os dois testes SQL rodam contra um Postgres de
verdade, sobre um banco instalado pelo `instalar.sql`.

O que falta não é código. É publicação, conteúdo e duas decisões.

---

## 1. Pôr o app no ar — é o que trava tudo

Enquanto isto não for feito, não existe endereço para instalar no celular. São três passos, uns
vinte minutos, e só podem ser feitos por você: as contas ficam no seu nome.

| | Onde | O que fazer |
| --- | --- | --- |
| 1 | supabase.com | Criar o projeto (região São Paulo), colar `supabase/instalar.sql` no SQL Editor e rodar |
| 2 | supabase.com | Criar seu usuário, rodar o `update ... set perfil = 'admin'`, copiar as três chaves |
| 3 | vercel.com/new | Importar o repositório, colar as três chaves, publicar |

O passo a passo detalhado, com o instalador do banco pronto para copiar de uma vez, está em
[`documentos/guia-de-instalacao.html`](documentos/guia-de-instalacao.html).

Duas coisas que já estão resolvidas e não precisam de atenção: a branch
`claude/new-session-qhl3bf` já é a branch principal do repositório, e o build compila limpo — a
Vercel não vai falhar por causa do código.

Um aviso que não é técnico: o plano grátis da Vercel é, pelos termos deles, para uso pessoal e não
comercial. Para uso da empresa o plano correto é o Pro.

---

## 2. Material — a logo já entrou; faltam as tabelas

**A logo da RV — feito.** O arquivo que você mandou já está no app, em `public/logo-rv.png` (a
logo completa) e `public/logo-rv-marca.png` (só o monograma, para os espaços pequenos). Ela
aparece sozinha, sem configurar nada:

- no topo do aplicativo, o monograma — a palavra "engenharia" viraria um borrão com 36 pixels;
- na tela de login, os documentos A4 e as planilhas xlsx, a logo completa;
- nos ícones da tela de início do celular, nos três tamanhos, com o recorte redondo respeitado.

Para trocar depois, é só preencher `empresa_logo_url` em Cadastros → Parâmetros: o que estiver lá
passa a mandar em todo lugar. Se esse endereço um dia falhar, o app volta para a logo que veio
com ele em vez de gerar documento sem marca.

**As tabelas de preço.** São dados públicos, mas **esta sessão não alcança os sites do governo**:
o proxy de rede recusa `caixa.gov.br`, `dnit.gov.br` e `cehop.se.gov.br` (403 na conexão). Consigo
pesquisar e ler resumos, não baixar arquivo. Então o caminho é: você baixa e **anexa o arquivo na
conversa** — daí eu converto para o formato do importador, e ensino o app a ler o arquivo original
para os meses seguintes serem só um envio.

Duas coisas que valem saber antes de baixar:

- **Desonerado ou não desonerado.** O SINAPI publica as duas versões, e a diferença aparece em
  todo preço com mão de obra. Para obra privada, o usual é a **não desonerada**; a decisão é sua,
  como responsável técnico.
- **ORSE é a tabela de Sergipe** (CEHOP/SE) — não existe "ORSE do Piauí". Ela costuma entrar como
  complemento, por ter composições que o SINAPI não tem, mas os preços são da realidade sergipana.
  O campo `uf` do importador registra isso.

Três bases entram por CSV e ainda estão vazias:

- SINAPI, ORSE e SICRO do Piauí, em Cadastros → Preços referenciais;
- as cotações dos fornecedores, em Cadastros → Base de preços — é ela que alimenta a cotação
  solar, então o módulo solar só monta a proposta depois que ela tiver preço de módulo, inversor,
  estrutura, cabo, string box e material elétrico;
- os cerca de 85 itens da tabela de locação, em Locação → Equipamentos.

Os três importadores aceitam o CSV exportado direto do Excel, com ponto e vírgula e decimal com
vírgula.

---

## 3. O código solar do Bernardo

O fluxo expresso já está construído e funcionando: em `/solar/expresso`, a conta do cliente vira
proposta numa tela só. O que falta é comparar com o que o Bernardo faz.

A carta com as seis perguntas está pronta para enviar:
[`documentos/RV-Engenharia-perguntas-modulo-solar.pdf`](documentos/RV-Engenharia-perguntas-modulo-solar.pdf).

Quando a resposta chegar, os números dele vão ser postos **lado a lado** com os que a
especificação define — HSP 5,4 · PR 0,78 · disponibilidade 30/50/100 kWh · degradação 0,55% ao ano
— para você escolher. Copiar os dele sem perguntar apagaria o que você mesmo especificou.

---

## 4. Decisão sua, já implementada dos dois jeitos

**A base do rateio com o parceiro** (item 14.2 da especificação). É configurável obra a obra, em
Cadastros → Obras, e está explicada no README. A tela de Resultado mostra as duas apurações
separadas, então dá para olhar os números de uma obra real antes de decidir.

---

## Fora desta versão

Levantamento de quantitativo a partir de projeto — forro, concreto, aço. É o item 14.10 da
especificação, que já o coloca fora do escopo desta versão.

---

## Confirmações da seção 14 que seguiram o padrão indicado

Todas implementadas como a especificação sugeriu, e todas ajustáveis sem mexer no código:

1. meia diária a 50%, editável pelo administrador no próprio lançamento;
2. rateio com o parceiro — ver acima;
3. recibo de pagamento do funcionário: incluído;
4. custo unitário no almoxarifado: incluído, e separado do valor de cobrança;
5. galeria de fotos da obra: incluída, com marcação antes/depois;
6. perfil de lançador: incluído, com o bloqueio garantido no banco;
7. orçamento com SINAPI/ORSE/SICRO e BDI: incluído;
8. base de preços de material: incluída;
9. módulo de locação: incluído, construído por último, como pedido.
