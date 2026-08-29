#!/usr/bin/env node
// =============================================================================
// RV Engenharia — aplicador de migracoes do banco
//
// PARA QUE SERVE: aplicar sozinho, no banco do Supabase, toda migracao nova que
// entrar em supabase/migrations. Roda no GitHub Actions a cada envio de codigo,
// para que ninguem precise abrir o SQL Editor e colar arquivo na mao.
//
// COMO DECIDE O QUE RODAR: a lista do que ja foi aplicado mora no proprio banco,
// na tabela public.migracoes_aplicadas. Nao mora em arquivo nem na maquina que
// roda — assim dois computadores diferentes chegam sempre a mesma conclusao.
//
// GARANTIAS:
//   * cada migracao roda dentro da sua propria transacao: ou entra inteira, ou
//     nao entra nada (psql --single-transaction + ON_ERROR_STOP);
//   * cada migracao roda no maximo uma vez;
//   * se um arquivo ja aplicado for editado depois, o script para e avisa, em
//     vez de deixar o banco silenciosamente diferente do repositorio;
//   * a URL do banco nunca e impressa na tela nem no registro do GitHub.
//
// USO:
//   SUPABASE_DB_URL=postgresql://... node scripts/migrar-banco.mjs
//   SUPABASE_DB_URL=postgresql://... node scripts/migrar-banco.mjs --listar
// =============================================================================

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PASTA = join(RAIZ, 'supabase', 'migrations')

// O banco de producao nasceu de supabase/instalar.sql, e nao arquivo por
// arquivo. Entao, na PRIMEIRA vez que este script encontra um banco que ja
// existe, ele marca como aplicadas — sem executar — todas as migracoes ate esta
// aqui, que e o que o instalador ja tinha quando o banco foi criado. Migracao
// mais nova que esta e aplicada normalmente.
// Em banco vazio nada disso vale: ali tudo roda desde a 0001.
const BASE_DO_INSTALADOR = '0009_desoneracao.sql'

const URL_BANCO = process.env.SUPABASE_DB_URL ?? ''
const APENAS_LISTAR = process.argv.includes('--listar')

// -----------------------------------------------------------------------------
// Conversa com o psql
// -----------------------------------------------------------------------------

/** Roda um comando SQL curto e devolve a saida crua, sem cabecalho nem moldura. */
function consultar(sql) {
  const r = spawnSync('psql', [URL_BANCO, '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
    encoding: 'utf8',
  })
  if (r.error) parar(`nao consegui executar o psql: ${r.error.message}`)
  if (r.status !== 0) parar(`o banco recusou um comando:\n${(r.stderr ?? '').trim()}`)
  return (r.stdout ?? '').trim()
}

/** Roda um arquivo .sql inteiro dentro de uma unica transacao. */
function executarArquivo(caminho) {
  const r = spawnSync(
    'psql',
    [URL_BANCO, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-f', caminho],
    { encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'] },
  )
  if (r.error) parar(`nao consegui executar o psql: ${r.error.message}`)
  if (r.status !== 0) parar(`a migracao falhou e foi desfeita inteira:\n${(r.stderr ?? '').trim()}`)
}

function parar(mensagem) {
  console.error(`\nERRO: ${mensagem}\n`)
  process.exit(1)
}

// -----------------------------------------------------------------------------
// Leitura da pasta de migracoes
// -----------------------------------------------------------------------------

/** Os arquivos .sql da pasta, em ordem de numero. */
function migracoesDoRepositorio() {
  const arquivos = readdirSync(PASTA)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
  for (const nome of arquivos) {
    // O nome entra em comando SQL adiante; so aceito o formato que a gente usa.
    if (!/^[0-9a-z_.-]+$/.test(nome)) parar(`nome de migracao fora do padrao: ${nome}`)
  }
  return arquivos.map((nome) => {
    const texto = readFileSync(join(PASTA, nome), 'utf8')
    return { nome, hash: createHash('sha256').update(texto).digest('hex') }
  })
}

// -----------------------------------------------------------------------------
// Tabela de controle
// -----------------------------------------------------------------------------

function prepararControle() {
  consultar(`
    create table if not exists public.migracoes_aplicadas (
      arquivo     text primary key,
      hash        text not null,
      aplicado_em timestamptz not null default now(),
      adotada     boolean not null default false
    );
    comment on table public.migracoes_aplicadas is
      'Quais arquivos de supabase/migrations ja entraram neste banco. Escrita so pelo robo de migracao.';
    -- Ela vive no schema public, entao ficaria visivel pela API do projeto.
    -- Ligando o RLS sem criar nenhuma politica, ninguem le pela API; o robo
    -- entra pela conexao direta do Postgres, que passa por cima do RLS.
    alter table public.migracoes_aplicadas enable row level security;
  `)
}

/** Mapa arquivo -> hash do que o banco diz que ja tem. */
function jaAplicadas() {
  const saida = consultar('select arquivo, hash from public.migracoes_aplicadas')
  const mapa = new Map()
  for (const linha of saida.split('\n')) {
    if (!linha) continue
    const [arquivo, hash] = linha.split('|')
    if (arquivo) mapa.set(arquivo, hash ?? '')
  }
  return mapa
}

function registrar(nome, hash, adotada) {
  consultar(
    `insert into public.migracoes_aplicadas (arquivo, hash, adotada)
     values ('${nome}', '${hash}', ${adotada ? 'true' : 'false'})
     on conflict (arquivo) do update set hash = excluded.hash, aplicado_em = now()`,
  )
}

/** O banco ja tinha vida antes deste robo? */
function bancoJaInstalado() {
  return consultar("select to_regclass('public.usuarios') is not null") === 't'
}

// -----------------------------------------------------------------------------
// Programa
// -----------------------------------------------------------------------------

if (!URL_BANCO) {
  console.error('Falta a variavel SUPABASE_DB_URL com a conexao do banco.')
  process.exit(2)
}

const migracoes = migracoesDoRepositorio()
console.log(`${migracoes.length} migracoes no repositorio.`)

prepararControle()
let aplicadas = jaAplicadas()

// Primeira vez contra um banco que ja existe: adota o que o instalador ja trouxe.
if (aplicadas.size === 0 && bancoJaInstalado()) {
  const base = migracoes.filter((m) => m.nome <= BASE_DO_INSTALADOR)
  console.log(
    `Banco ja existente. Marcando ${base.length} migracoes como ja instaladas ` +
      `(ate ${BASE_DO_INSTALADOR}) sem executar nada.`,
  )
  for (const m of base) registrar(m.nome, m.hash, true)
  aplicadas = jaAplicadas()
}

// Arquivo aplicado que mudou depois significa banco diferente do repositorio.
const alterados = migracoes.filter((m) => aplicadas.has(m.nome) && aplicadas.get(m.nome) !== m.hash)
if (alterados.length > 0) {
  parar(
    `estas migracoes ja foram aplicadas e depois foram editadas:\n` +
      alterados.map((m) => `  - ${m.nome}`).join('\n') +
      `\n\nO banco nao vai mudar sozinho por causa de uma edicao. ` +
      `Crie uma migracao NOVA com a correcao em vez de mexer numa ja aplicada.`,
  )
}

const pendentes = migracoes.filter((m) => !aplicadas.has(m.nome))

if (pendentes.length === 0) {
  console.log('Nada pendente: o banco ja esta em dia com o repositorio.')
  process.exit(0)
}

console.log(`\nPendentes (${pendentes.length}):`)
for (const m of pendentes) console.log(`  - ${m.nome}`)

if (APENAS_LISTAR) {
  console.log('\nModo listagem: nada foi aplicado.')
  process.exit(0)
}

console.log('')
for (const m of pendentes) {
  console.log(`Aplicando ${m.nome} ...`)
  executarArquivo(join(PASTA, m.nome))
  registrar(m.nome, m.hash, false)
  console.log(`  ok`)
}

console.log(`\nPronto: ${pendentes.length} migracao(oes) aplicada(s).`)
