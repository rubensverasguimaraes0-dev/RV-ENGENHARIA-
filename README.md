# App de Gestão — RV Engenharia

Aplicativo web (PWA) de uso interno da RV Engenharia, acessível do celular e do computador, com os
dados na nuvem. Construído a partir da especificação *ESPECIFICACAO_APP_RV_ENGENHARIA_v3*.

Responsável técnico: **Rubens Veras Guimarães — Eng. Civil — CREA-PI 35900**. Teresina/PI.

O princípio do módulo de obras: tudo que hoje é feito no papel, no WhatsApp e em planilha avulsa
passa a ser lançado uma única vez no celular, e os documentos saem prontos.

---

## O que está pronto

Todos os catorze itens da ordem de construção da especificação estão entregues.

| Item | Módulo |
| --- | --- |
| 1 | Estrutura, banco, autenticação e perfis |
| 2 | Cadastros: clientes, obras, locais, funcionários, parceiros |
| 3 | Lançamento diário, semanas, fechamento semanal e recibo |
| 4 | Notas fiscais com foto, rateio, despesa sem nota, checklist e relatório |
| 5 | Cronograma de pagamentos com comprovantes |
| 6 | Fechamento e relatório de débitos, com as versões de exibição |
| 7 | Almoxarifado |
| 8 | Medições e serviços de terceiros |
| 9 | Orçamentos rápido e completo, com base referencial e BDI |
| 10 | Resultado da obra e rateio com o parceiro |
| 11 | Arquivos recebidos e galeria de fotos |
| 12 | Base de preços de material e cotações de fornecedor |
| 13 | Módulo de energia solar, do dimensionamento à proposta |
| 14 | Módulo de locação de equipamentos |

Fora desta versão, por decisão da própria especificação (item 14.10):
levantamento de quantitativo a partir de projeto.

Duas pendências de conteúdo, não de código, estão anotadas em
[`PENDENCIAS.md`](PENDENCIAS.md).

## Como rodar

Requer Node 20 ou superior.

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev                  # http://localhost:3000
```

Sem as variáveis de ambiente o app abre em `/configurar`, com o passo a passo na tela — não quebra.

### Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute na ordem os arquivos de `supabase/migrations`:
   - `0001_schema.sql` — tabelas, tipos e índices
   - `0002_rls.sql` — perfis, políticas de acesso, views seguras e funções de lançamento
   - `0003_seed.sql` — parâmetros e fornecedores já usados
   - `0004_storage.sql` — buckets de fotos, comprovantes e arquivos
   - `0005_servico_quantidade.sql` — quantidade e unidade no serviço do fechamento
   - `0006_orcamento.sql` — base de preços referenciais e complementos do orçamento
   - `0007_parametros_solar.sql` — parâmetros da cotação solar
3. Ligue a trigger que cria o perfil quando um usuário nasce no Auth:

   ```sql
   create trigger ao_criar_usuario
     after insert on auth.users
     for each row execute function public.ao_criar_usuario_auth();
   ```

4. Em **Project Settings → API**, copie a URL e as chaves para o `.env.local`.
5. Em **Authentication → Users**, crie o usuário do engenheiro e promova-o a administrador:

   ```sql
   update public.usuarios set perfil = 'admin' where email = 'seu@email.com';
   ```

Os demais usuários podem ser criados pela própria tela de **Cadastros → Usuários**, que usa a
`SUPABASE_SERVICE_ROLE_KEY`.

### Publicar

Projeto pronto para a Vercel: importe o repositório, configure as três variáveis de ambiente e
publique. No celular, use "Adicionar à tela de início" para instalar como aplicativo.

---

## Testes

```bash
npm test          # 214 testes das regras de negócio, do CSV e das planilhas geradas
npm run typecheck # TypeScript em modo estrito
npm run build     # build de produção
```

Os **trinta casos da seção 10 da especificação** estão cobertos, cada um nomeado pelo seu número:
vinte e nove nos testes acima, e o caso 25 — o perfil de lançador — no teste SQL abaixo, que é
onde ele pode ser provado de verdade. Do fechamento com diárias diferentes ao dimensionamento
solar, passando pelo sábado, pela meia diária, pelas faixas de quentinha, pela semana encerrada na
quinta, pela nota sem foto que barra o relatório, pelo rateio entre locais, pelo recebimento com
valor de outro contrato, pelo BDI embutido, pelo item a cotar separadamente e pela proposta solar
sem custo nem margem.

O teste de permissões roda contra um Postgres de verdade e prova o caso 25 — o lançador não lê
contrato, custo, orçamento nem resultado:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
```

---

## Como o projeto está organizado

```
src/
  app/                     telas (Next.js App Router)
    (app)/obras/[obraId]/  painel, lançamento diário, semanas, notas, pagamentos,
                           almoxarifado, medições, fechamento, orçamentos, arquivos, resultado
    (app)/cadastros/       clientes, obras, funcionários, fornecedores, terceiros, usuários,
                           base de preços, preços referenciais, parâmetros
    (app)/solar/           projetos, cotação, proposta e calculadora
    (app)/locacao/         equipamentos, tabela de preços, contratos e devolução
    api/                   geração das planilhas xlsx
  components/              tabela, formulário, captura de foto, seletor de versão,
                           casca dos documentos A4
  lib/
    domain/                regras de negócio puras, com teste (é o coração do app)
    dados/                 leitura do banco para as telas
    docs/                  geração das planilhas, com estilo compartilhado
    csv.ts                 leitura de CSV do Excel em pt-BR
    format.ts              pt-BR: moeda, datas, semanas
supabase/
  migrations/              esquema, RLS, seed, buckets e evoluções
  tests/                   teste SQL de permissões
```

### Decisões que valem saber

**Dinheiro é inteiro, em centavos.** Nunca ponto flutuante. O total de um relatório enviado ao
cliente não pode depender de arredondamento.

**Datas de calendário são texto `aaaa-mm-dd`.** `new Date('2026-08-27')` vira UTC e volta um dia
— um erro que apareceria justamente na virada da semana.

**O bloqueio por perfil está no banco, não na tela.** O lançador não tem permissão de leitura nas
tabelas de contrato, custo, orçamento e resultado; o que ele precisa ver chega por views que
expõem só as colunas permitidas (`obras_visiveis`, `funcionarios_visiveis`). O valor da diária
nunca trafega pelo cliente dele: é resolvido no servidor pela função `registrar_presenca`.

**Nada é apagado.** Exclusão é lógica, via `excluido_em`.

**Todo total de planilha sai por fórmula.** As células de soma recebem `{ formula }`, e há teste
que abre o arquivo gerado e confere isso.

**Nenhum valor de referência fica fixo no código.** Quentinha, meia diária, margem, BDI, HSP,
percentual do Fio B e textos padrão moram na tabela `parametros`, editável em Cadastros.

**PDF sai do HTML.** Os documentos são páginas A4 com CSS de impressão: *Imprimir → Salvar como
PDF* gera o arquivo pronto para o WhatsApp, sem depender de serviço externo.

**O seletor de versão passa por um filtro final.** Todo documento de cliente é gerado através de
`versaoParaCliente()`, que desliga BDI e margem mesmo que alguém os marque na tela. A versão para
o pedreiro não carrega valor nenhum, custe o que custar.

**O CSV é lido por um parser próprio.** Os arquivos reais vêm do Excel em pt-BR — ponto e vírgula,
BOM, acento, aspas e decimal com vírgula — e um parser genérico erra justamente nesses casos.

---

## Ponto que precisa da sua confirmação

A especificação marca vários itens como `[CONFIRMAR]` e foram adotados os padrões indicados. Um
deles muda dinheiro e merece uma decisão consciente — **a base do rateio com o parceiro** (item
14.2). Ele é configurável obra a obra, em Cadastros → Obras:

- **Resultado da obra** (padrão): o parceiro divide o que sobra depois de a RV liquidar materiais,
  locações, entulho e terceiros. Na obra de piso do exemplo da especificação — R$ 10.960,00
  cobrados, R$ 7.795,89 de custo — o resultado é R$ 3.164,11 e o parceiro fica com R$ 1.582,06.
- **Margem da mão de obra**: o parceiro divide apenas contrato e medições menos diárias e
  quentinhas, ficando o resultado de insumos inteiro com a RV. Na mesma obra, a base seria
  R$ 7.460,00 e o parceiro ficaria com R$ 3.730,00 — mais do que o resultado total da obra.

A tela de Resultado mostra as duas apurações separadas, como pede o item 4.15. Prejuízo não é
rateado: base negativa fica inteira com a RV.

Os demais padrões adotados seguem o que a especificação indicou: meia diária a 50% (editável no
lançamento pelo administrador), recibo do funcionário incluído, custo unitário no almoxarifado
incluído, perfil de lançador incluído.
