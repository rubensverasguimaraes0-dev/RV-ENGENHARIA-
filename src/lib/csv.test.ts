import { describe, expect, it } from 'vitest'
import { coluna, detectarSeparador, lerCSV, normalizarChave } from './csv'
import { lerMoeda } from './format'

describe('leitura de CSV exportado do Excel em pt-BR', () => {
  it('usa ponto e vírgula, que é o padrão do Excel brasileiro', () => {
    expect(detectarSeparador('codigo;descricao;preco')).toBe(';')
    expect(detectarSeparador('codigo,descricao,preco')).toBe(',')
    expect(detectarSeparador('codigo\tdescricao\tpreco')).toBe('\t')
  })

  it('lê linhas simples', () => {
    const linhas = lerCSV('codigo;descricao;preco\n87449;Alvenaria de vedação;65,00')
    expect(linhas).toHaveLength(1)
    expect(linhas[0]!.codigo).toBe('87449')
    expect(linhas[0]!.descricao).toBe('Alvenaria de vedação')
  })

  it('respeita a vírgula dentro de aspas — o erro clássico', () => {
    const linhas = lerCSV('codigo,descricao,preco\n87449,"Alvenaria de vedação, bloco cerâmico",65.00')
    expect(linhas[0]!.descricao).toBe('Alvenaria de vedação, bloco cerâmico')
    expect(linhas[0]!.preco).toBe('65.00')
  })

  it('entende aspas escapadas e quebra de linha dentro do campo', () => {
    const linhas = lerCSV('codigo;descricao\n1;"Item ""especial""\ncom duas linhas"')
    expect(linhas[0]!.descricao).toBe('Item "especial"\ncom duas linhas')
  })

  it('remove o BOM que o Excel escreve no começo do arquivo', () => {
    const linhas = lerCSV('﻿codigo;descricao\n1;Teste')
    expect(linhas[0]!.codigo).toBe('1')
  })

  it('ignora linhas em branco no fim do arquivo', () => {
    const linhas = lerCSV('codigo;descricao\n1;Um\n\n2;Dois\n\n')
    expect(linhas).toHaveLength(2)
  })

  it('devolve vazio quando só há cabeçalho', () => {
    expect(lerCSV('codigo;descricao')).toEqual([])
    expect(lerCSV('')).toEqual([])
  })
})

describe('normalização do cabeçalho', () => {
  it('tira acento, espaço e maiúscula', () => {
    expect(normalizarChave('Preço Unitário')).toBe('preco_unitario')
    expect(normalizarChave('CÓDIGO DA COMPOSIÇÃO')).toBe('codigo_da_composicao')
    expect(normalizarChave('  Descrição  ')).toBe('descricao')
  })

  it('aceita nomes alternativos da mesma coluna', () => {
    const linha = { codigo_da_composicao: '87449', preco_unitario: '65,00' }
    expect(coluna(linha, 'codigo', 'codigo da composicao')).toBe('87449')
    expect(coluna(linha, 'preco', 'preco unitario')).toBe('65,00')
    expect(coluna(linha, 'inexistente')).toBe('')
  })
})

describe('CSV de tabela de referência, como sai na prática', () => {
  const csv = [
    'Código;Descrição;Unidade;Preço Unitário;Data Base',
    '87449;"ALVENARIA DE VEDAÇÃO, BLOCO CERÂMICO";M2;65,00;01/05/2026',
    '88489;PINTURA LÁTEX ACRÍLICA;M2;18,50;01/05/2026',
  ].join('\n')

  it('lê os campos com acento, aspas e decimal com vírgula', () => {
    const linhas = lerCSV(csv)
    expect(linhas).toHaveLength(2)
    expect(coluna(linhas[0]!, 'descricao')).toBe('ALVENARIA DE VEDAÇÃO, BLOCO CERÂMICO')
    expect(lerMoeda(coluna(linhas[0]!, 'preco unitario'))).toBe(6500)
    expect(lerMoeda(coluna(linhas[1]!, 'preco unitario'))).toBe(1850)
  })
})
