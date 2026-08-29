import { describe, expect, it } from 'vitest'
import { acharFornecedor, interpretarLeitura, resumoDaLeitura } from './leitura-nota'

describe('interpretar o que a IA leu da nota', () => {
  it('leitura completa passa inteira', () => {
    const l = interpretarLeitura({
      fornecedor: 'Comercial Ferragens LTDA',
      cnpj: '12.345.678/0001-90',
      numero_nota: '004512',
      data: '2026-08-29',
      valor: '1.234,56',
      categoria: 'material',
      descricao: 'cimento e areia',
      forma_pagamento: 'pix',
    })
    expect(l.valor).toBe(123456)
    expect(l.data).toBe('2026-08-29')
    expect(l.categoria).toBe('material')
    expect(l.fornecedor).toBe('Comercial Ferragens LTDA')
  })

  it('valor vem de todo jeito: numero, texto com R$, virgula', () => {
    expect(interpretarLeitura({ valor: 476.4 }).valor).toBe(47640)
    expect(interpretarLeitura({ valor: 'R$ 476,40' }).valor).toBe(47640)
    expect(interpretarLeitura({ valor: '476,40' }).valor).toBe(47640)
  })

  it('ponto decimal NAO vira cem vezes o valor — era o defeito mais caro', () => {
    // "476.40" lido pelo lerMoeda puro virava R$ 47.640,00.
    expect(interpretarLeitura({ valor: '476.40' }).valor).toBe(47640)
    expect(interpretarLeitura({ valor: '476.4' }).valor).toBe(47640)
    expect(interpretarLeitura({ valor: 'R$ 476.40' }).valor).toBe(47640)
  })

  it('milhar continua milhar: com ponto, com virgula americana, misturado', () => {
    expect(interpretarLeitura({ valor: '1.234' }).valor).toBe(123400)
    expect(interpretarLeitura({ valor: '1.234,56' }).valor).toBe(123456)
    expect(interpretarLeitura({ valor: '1,234.56' }).valor).toBe(123456)
    expect(interpretarLeitura({ valor: '1.234.567' }).valor).toBe(123456700)
  })

  it('valor zero ou negativo nao preenche nada — nota de valor zero nao existe', () => {
    expect(interpretarLeitura({ valor: 0 }).valor).toBeNull()
    expect(interpretarLeitura({ valor: -10 }).valor).toBeNull()
  })

  it('data em dd/mm/aaaa vira aaaa-mm-dd; data invalida vira nulo', () => {
    expect(interpretarLeitura({ data: '29/08/2026' }).data).toBe('2026-08-29')
    expect(interpretarLeitura({ data: 'ontem' }).data).toBeNull()
  })

  it('data que so parece data cai fora: mes 31 nao existe, 30 de fevereiro tampouco', () => {
    // "12/31/2026" no habito americano virava "2026-31-12" e passava.
    expect(interpretarLeitura({ data: '2026-31-12' }).data).toBeNull()
    expect(interpretarLeitura({ data: '2026-02-30' }).data).toBeNull()
    expect(interpretarLeitura({ data: '1990-05-05' }).data).toBeNull()
  })

  it('categoria fora da lista vira nulo, nunca um chute gravado', () => {
    expect(interpretarLeitura({ categoria: 'ferramentas' }).categoria).toBeNull()
    expect(interpretarLeitura({ categoria: 'Material' }).categoria).toBe('material')
  })

  it('"não identificado" e parentes viram nulo, nao um fornecedor com esse nome', () => {
    expect(interpretarLeitura({ fornecedor: 'não identificado' }).fornecedor).toBeNull()
    expect(interpretarLeitura({ fornecedor: 'ilegível' }).fornecedor).toBeNull()
    expect(interpretarLeitura({ fornecedor: '---' }).fornecedor).toBeNull()
    expect(interpretarLeitura({ fornecedor: 'sem valor' }).fornecedor).toBeNull()
  })

  it('fornecedor de verdade que COMECA parecido com sentinela passa inteiro', () => {
    // O filtro por prefixo derrubava estes tres.
    expect(interpretarLeitura({ fornecedor: 'Semar Supermercado' }).fornecedor).toBe('Semar Supermercado')
    expect(interpretarLeitura({ fornecedor: 'Sempre Forte Ferragens' }).fornecedor).toBe('Sempre Forte Ferragens')
    expect(interpretarLeitura({ fornecedor: 'Não-Me-Toque Materiais' }).fornecedor).toBe('Não-Me-Toque Materiais')
  })

  it('lixo na entrada devolve tudo nulo em vez de quebrar', () => {
    const l = interpretarLeitura('um texto qualquer')
    expect(l.valor).toBeNull()
    expect(l.fornecedor).toBeNull()
    const m = interpretarLeitura(null)
    expect(m.data).toBeNull()
  })
})

describe('achar o fornecedor lido entre os cadastrados', () => {
  const lista = [
    { id: 'a', nome: 'Comercial Ferragens' },
    { id: 'b', nome: 'Depósito São José' },
  ]

  it('acha ignorando caixa, acento e LTDA', () => {
    expect(acharFornecedor('COMERCIAL FERRAGENS LTDA', lista)).toBe('a')
    expect(acharFornecedor('deposito sao jose', lista)).toBe('b')
  })

  it('dois parecidos = nulo — em empate quem decide e a pessoa', () => {
    const ambiguo = [
      { id: 'a', nome: 'Ferragens Norte' },
      { id: 'b', nome: 'Ferragens Norte Sul' },
    ]
    expect(acharFornecedor('Ferragens Norte', ambiguo)).toBeNull()
  })

  it('nome curto demais nao casa com nada', () => {
    expect(acharFornecedor('SJ', lista)).toBeNull()
    expect(acharFornecedor(null, lista)).toBeNull()
  })
})

describe('resumo da leitura', () => {
  it('diz o que veio', () => {
    const l = interpretarLeitura({ valor: '10,00', data: '2026-08-29' })
    expect(resumoDaLeitura(l)).toContain('valor')
    expect(resumoDaLeitura(l)).toContain('data')
    expect(resumoDaLeitura(l)).not.toContain('fornecedor')
  })

  it('diz quando nao veio nada', () => {
    expect(resumoDaLeitura(interpretarLeitura({}))).toContain('Não deu para ler')
  })
})

describe('ponto decimal com mais de duas casas', () => {
  it('tarifa impressa com seis casas nao vira milhar', () => {
    // "0.867459" virava R$ 8.674,59; parte inteira "0" nunca e milhar.
    expect(interpretarLeitura({ valor: '0.867459' }).valor).toBe(87)
    expect(interpretarLeitura({ valor: '0.895' }).valor).toBe(90)
  })

  it('grupo de milhar de verdade continua milhar', () => {
    expect(interpretarLeitura({ valor: '1.234' }).valor).toBe(123400)
    expect(interpretarLeitura({ valor: '12.345' }).valor).toBe(1234500)
  })
})
