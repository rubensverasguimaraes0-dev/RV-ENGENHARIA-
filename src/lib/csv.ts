/**
 * Leitura de CSV das tabelas de referencia e das tabelas de preco (spec 4.13,
 * 6.1 e 7). Escrito a mao de proposito: o que chega e CSV exportado do Excel em
 * pt-BR, com ponto e virgula, aspas e valor decimal com virgula — e isso um
 * parser generico costuma errar.
 */

export type LinhaCSV = Record<string, string>

/** Detecta o separador olhando a primeira linha: ; e o padrao do Excel pt-BR. */
export function detectarSeparador(texto: string): ';' | ',' | '\t' {
  const primeira = texto.split(/\r?\n/)[0] ?? ''
  const candidatos: (';' | ',' | '\t')[] = [';', '\t', ',']
  let melhor: ';' | ',' | '\t' = ';'
  let maximo = -1
  for (const c of candidatos) {
    const n = contarFora(primeira, c)
    if (n > maximo) {
      maximo = n
      melhor = c
    }
  }
  return melhor
}

function contarFora(linha: string, separador: string): number {
  let dentro = false
  let n = 0
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (ch === '"') dentro = !dentro
    else if (!dentro && ch === separador) n++
  }
  return n
}

/** Quebra o CSV em campos, respeitando aspas e quebra de linha dentro delas. */
export function lerCSV(texto: string, separador?: string): LinhaCSV[] {
  const limpo = texto.replace(/^﻿/, '') // BOM do Excel
  const sep = separador ?? detectarSeparador(limpo)

  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let dentroDeAspas = false

  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]

    if (dentroDeAspas) {
      if (ch === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          dentroDeAspas = false
        }
      } else {
        campo += ch
      }
      continue
    }

    if (ch === '"') {
      dentroDeAspas = true
    } else if (ch === sep) {
      linha.push(campo)
      campo = ''
    } else if (ch === '\n') {
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else if (ch !== '\r') {
      campo += ch
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }

  const naoVazias = linhas.filter((l) => l.some((c) => c.trim() !== ''))
  if (naoVazias.length < 2) return []

  const cabecalho = naoVazias[0]!.map(normalizarChave)

  return naoVazias.slice(1).map((valores) => {
    const registro: LinhaCSV = {}
    cabecalho.forEach((chave, i) => {
      if (chave) registro[chave] = (valores[i] ?? '').trim()
    })
    return registro
  })
}

/** 'Preço Unitário' => 'preco_unitario'; deixa o cabecalho previsivel. */
export function normalizarChave(bruto: string): string {
  return bruto
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Le a primeira coluna existente entre os nomes aceitos. As tabelas publicas
 * mudam o nome da coluna de uma edicao para outra.
 */
export function coluna(linha: LinhaCSV, ...nomes: string[]): string {
  for (const nome of nomes) {
    const valor = linha[normalizarChave(nome)]
    if (valor !== undefined && valor !== '') return valor
  }
  return ''
}
