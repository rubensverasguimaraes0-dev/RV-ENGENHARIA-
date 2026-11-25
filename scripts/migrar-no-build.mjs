#!/usr/bin/env node
// =============================================================================
// RV Engenharia — banco que se atualiza na publicacao da Vercel
//
// POR QUE EXISTE: o robo do GitHub Actions (migrar-banco.mjs) depende de um
// segredo SUPABASE_DB_URL cadastrado a mao no GitHub, e esse segredo estava
// errado desde agosto — as migracoes 0010 a 0014 nunca chegaram ao banco.
//
// A Vercel ja tem a conexao do banco: a integracao do Supabase pelo Vercel
// Marketplace cadastra POSTGRES_URL_NON_POOLING e POSTGRES_URL no projeto
// sozinha. Entao, a cada publicacao de PRODUCAO, este script aplica o que estiver
// pendente antes do `next build`. Ninguem precisa cadastrar nada.
//
// MESMAS REGRAS do migrar-banco.mjs, sobre a mesma tabela public.migracoes_aplicadas:
//   * cada migracao roda uma vez, dentro da sua propria transacao;
//   * banco que ja existia adota ate a 0009 sem executar;
//   * arquivo ja aplicado e depois editado faz parar, sem mexer em nada.
//
// NUNCA DERRUBA A PUBLICACAO: banco fora do ar, conexao recusada ou migracao com
// erro viram aviso no registro da Vercel e o build segue. O app foi feito para
// aguentar banco atrasado (coluna nova lida a parte, tabela nova com `?? []`);
// um site fora do ar por causa de uma migracao seria pior.
// =============================================================================

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PASTA = join(RAIZ, 'supabase', 'migrations')
const BASE_DO_INSTALADOR = '0009_desoneracao.sql'

const log = (msg) => console.log(`[banco] ${msg}`)
const aviso = (msg) => console.warn(`[banco] AVISO: ${msg}`)

/** Conexoes candidatas, da mais adequada para a menos. Nunca impressas. */
function conexoesCandidatas() {
  return [
    process.env.SUPABASE_DB_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
  ].filter((u, i, todas) => u && todas.indexOf(u) === i)
}

/**
 * O certificado do Supabase e assinado pela CA do proprio Supabase, que o Node
 * nao conhece; com o sslmode da URL o pg recusaria a conexao. A conexao continua
 * cifrada — so nao valida a cadeia.
 */
function configDoCliente(url) {
  const u = new URL(url)
  u.searchParams.delete('sslmode')
  u.searchParams.delete('supa')
  const local = ['localhost', '127.0.0.1'].includes(u.hostname)
  return {
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 120_000,
  }
}

async function conectar() {
  for (const url of conexoesCandidatas()) {
    const cliente = new pg.Client(configDoCliente(url))
    try {
      await cliente.connect()
      return cliente
    } catch (erro) {
      aviso(`uma das conexoes nao respondeu (${erro.code ?? erro.message}); tentando a proxima.`)
      await cliente.end().catch(() => {})
    }
  }
  return null
}

function migracoesDoRepositorio() {
  return readdirSync(PASTA)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .map((nome) => {
      const texto = readFileSync(join(PASTA, nome), 'utf8')
      return { nome, texto, hash: createHash('sha256').update(texto).digest('hex') }
    })
}

async function migrar(db) {
  const migracoes = migracoesDoRepositorio()

  await db.query(`
    create table if not exists public.migracoes_aplicadas (
      arquivo     text primary key,
      hash        text not null,
      aplicado_em timestamptz not null default now(),
      adotada     boolean not null default false
    );
    alter table public.migracoes_aplicadas enable row level security;
  `)

  const lerAplicadas = async () =>
    new Map((await db.query('select arquivo, hash from public.migracoes_aplicadas')).rows.map((r) => [r.arquivo, r.hash]))
  const registrar = (nome, hash, adotada) =>
    db.query(
      `insert into public.migracoes_aplicadas (arquivo, hash, adotada) values ($1, $2, $3)
       on conflict (arquivo) do update set hash = excluded.hash, aplicado_em = now()`,
      [nome, hash, adotada],
    )

  let aplicadas = await lerAplicadas()

  if (aplicadas.size === 0) {
    const { rows } = await db.query("select to_regclass('public.usuarios') is not null as existe")
    if (rows[0].existe) {
      const base = migracoes.filter((m) => m.nome <= BASE_DO_INSTALADOR)
      log(`banco ja existente: marcando ${base.length} migracoes ate ${BASE_DO_INSTALADOR} como instaladas.`)
      for (const m of base) await registrar(m.nome, m.hash, true)
      aplicadas = await lerAplicadas()
    }
  }

  const alteradas = migracoes.filter((m) => aplicadas.has(m.nome) && aplicadas.get(m.nome) !== m.hash)
  if (alteradas.length > 0) {
    aviso(
      `migracoes ja aplicadas foram editadas depois (${alteradas.map((m) => m.nome).join(', ')}). ` +
        'Nada foi aplicado: a correcao precisa vir em migracao NOVA.',
    )
    return
  }

  const pendentes = migracoes.filter((m) => !aplicadas.has(m.nome))
  if (pendentes.length === 0) {
    log('nada pendente: o banco ja esta em dia.')
    return
  }

  for (const m of pendentes) {
    log(`aplicando ${m.nome} ...`)
    try {
      await db.query('begin')
      await db.query(m.texto)
      await registrar(m.nome, m.hash, false)
      await db.query('commit')
    } catch (erro) {
      await db.query('rollback').catch(() => {})
      aviso(`${m.nome} falhou e foi desfeita inteira: ${erro.message}. As seguintes ficam para a proxima publicacao.`)
      return
    }
  }
  log(`pronto: ${pendentes.length} migracao(oes) aplicada(s).`)
}

async function principal() {
  // So a publicacao de producao mexe no banco de verdade. Preview de branch de
  // experimento nao encosta nele; rodar a mao fora da Vercel exige pedir.
  const naVercel = Boolean(process.env.VERCEL)
  if (naVercel && process.env.VERCEL_ENV !== 'production') {
    log(`publicacao de ${process.env.VERCEL_ENV}: banco nao e tocado.`)
    return
  }
  if (!naVercel && !process.argv.includes('--agora')) return

  if (conexoesCandidatas().length === 0) {
    aviso('nenhuma conexao do banco nas variaveis (POSTGRES_URL_NON_POOLING, POSTGRES_URL, SUPABASE_DB_URL).')
    return
  }

  const db = await conectar()
  if (!db) {
    aviso('o banco nao respondeu (pausado ou fora do ar?). Migracoes ficam para a proxima publicacao.')
    return
  }
  try {
    await migrar(db)
  } finally {
    await db.end().catch(() => {})
  }
}

principal().catch((erro) => aviso(`erro inesperado, publicacao segue: ${erro.message}`))
