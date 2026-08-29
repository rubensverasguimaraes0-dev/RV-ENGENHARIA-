# Banco que se atualiza sozinho

Antes: toda vez que o app ganhava uma tabela nova, alguém precisava abrir o
painel do Supabase, achar o SQL Editor, copiar um arquivo e clicar em Run.

Agora: o arquivo entra em `supabase/migrations/`, é enviado ao GitHub, e o banco
se atualiza sozinho em menos de um minuto. Ninguém abre o SQL Editor.

## As peças

| Peça | O que faz |
| --- | --- |
| `supabase/migrations/*.sql` | Cada mudança do banco, um arquivo, em ordem de número. |
| `scripts/migrar-banco.mjs` | Descobre o que falta e aplica, uma migração por transação. |
| `.github/workflows/banco.yml` | Chama o script sozinho a cada envio de migração nova. |
| `public.migracoes_aplicadas` | A memória: quais arquivos já entraram neste banco. |

## Configuração — uma vez só, nunca mais

**1. Pegar a conexão do banco.** No painel do Supabase, botão **Connect** no topo
→ aba **Session pooler** → copiar a URI. Ela é parecida com:

```
postgresql://postgres.SEUPROJETO:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres
```

Tem que ser a do **Session pooler**, não a *Direct connection*: as máquinas do
GitHub não alcançam o endereço da conexão direta.

Se a senha do banco não estiver à mão, ela pode ser trocada sem quebrar nada em
**Settings → Database → Database password → Reset**. O app não usa essa senha —
ele entra pelas chaves do projeto —, então trocar não derruba o site.

**2. Guardar no GitHub.** No repositório `rv-engenharia`:
**Settings → Secrets and variables → Actions → New repository secret**

- Name: `SUPABASE_DB_URL`
- Secret: a URI copiada, com a senha no lugar

Essa senha fica guardada e cifrada no GitHub. Não aparece no registro das
execuções, não vai por conversa, não vai por WhatsApp.

Pronto. A partir daí é automático.

## O dia a dia

- Migração nova chega no repositório → o robô aplica. Nada a fazer.
- Para ver o que aconteceu: aba **Actions** do repositório, fluxo **Migrar banco**.
- Para rodar na mão: **Actions → Migrar banco → Run workflow**. Marcando
  *"So mostrar o que esta pendente"*, ele apenas lista, sem tocar no banco.

## As garantias

- **Cada migração roda uma vez só.** A lista fica no próprio banco, não no
  computador de quem envia.
- **Ou entra inteira, ou não entra nada.** Cada arquivo roda dentro de uma
  transação. Migração que falha no meio é desfeita por completo e o robô para
  com o erro na tela — não deixa o banco pela metade.
- **Banco que já existia é respeitado.** Na primeira execução, se o banco já
  tem as tabelas (foi criado com `instalar.sql`), o robô marca as migrações até
  a `0009` como já instaladas em vez de tentar criar tudo de novo.
- **Banco vazio também funciona.** Aí ele instala da `0001` até a última.
- **Arquivo já aplicado não pode ser editado.** Se for, o robô para e avisa: a
  correção tem que vir numa migração nova, senão o banco fica diferente do que
  está escrito no repositório.
- **Sem o segredo, ele não quebra nada.** Avisa que falta configurar e sai.

## O que continua sendo na mão

O robô só faz o que é SQL. Continuam fora dele, cada um uma vez só:

- criar usuário e trocar senha (Authentication);
- endereços de e-mail e redirecionamento do Auth (URL Configuration);
- variáveis de ambiente da Vercel.
