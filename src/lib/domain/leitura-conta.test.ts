import { describe, expect, it } from 'vitest'
import { interpretarLeituraConta, resumoDaLeituraConta } from './leitura-conta'

describe('interpretar a conta de energia lida pela IA', () => {
  it('conta completa: consumo, media do historico, tarifa efetiva', () => {
    const l = interpretarLeituraConta({
      cliente_nome: 'Romulo Veras',
      uc: '0012345678',
      distribuidora: 'Equatorial Piauí',
      tipo_ligacao: 'trifásica',
      consumo_kwh_mes: 512,
      historico_kwh: [480, 520, 505, 495, 530, 510],
      valor_total: '512,00',
      tarifa: '0,89',
      mes_referencia: 'AGO/2026',
    })
    expect(l.consumo_mes_kwh).toBe(512)
    expect(l.consumo_medio_kwh).toBe(Math.round((480 + 520 + 505 + 495 + 530 + 510) / 6))
    // tarifa efetiva = 51200 centavos / 512 kWh = 100 centavos/kWh
    expect(l.tarifa).toBe(100)
    expect(l.tipo_ligacao).toBe('trifasica')
    expect(l.uc).toBe('0012345678')
  })

  it('mes zerado no historico nao derruba a media — relogio sem leitura nao e consumo', () => {
    const l = interpretarLeituraConta({
      consumo_kwh_mes: 500,
      historico_kwh: [500, 0, 500, 500, 2, 500],
    })
    expect(l.consumo_medio_kwh).toBe(500)
  })

  it('historico curto demais: a media cai para o proprio mes', () => {
    const l = interpretarLeituraConta({ consumo_kwh_mes: 480, historico_kwh: [500] })
    expect(l.consumo_medio_kwh).toBe(480)
  })

  it('tarifa efetiva absurda vira nulo — total ou consumo foi lido errado', () => {
    // 5.000,00 / 50 kWh = R$ 100/kWh: impossivel, alguem leu errado.
    const l = interpretarLeituraConta({ consumo_kwh_mes: 50, valor_total: '5.000,00' })
    expect(l.tarifa).toBeNull()
  })

  it('sem total legivel, vale a tarifa impressa quando plausivel', () => {
    const l = interpretarLeituraConta({ consumo_kwh_mes: 500, tarifa: '0,95' })
    expect(l.tarifa).toBe(95)
  })

  it('ligacao vem de todo jeito: Trifásico, monofasico, BIFÁSICA', () => {
    expect(interpretarLeituraConta({ tipo_ligacao: 'Trifásico' }).tipo_ligacao).toBe('trifasica')
    expect(interpretarLeituraConta({ tipo_ligacao: 'monofasico' }).tipo_ligacao).toBe('monofasica')
    expect(interpretarLeituraConta({ tipo_ligacao: 'BIFÁSICA' }).tipo_ligacao).toBe('bifasica')
    expect(interpretarLeituraConta({ tipo_ligacao: 'estrela' }).tipo_ligacao).toBeNull()
  })

  it('consumo fora do plausivel vira nulo', () => {
    expect(interpretarLeituraConta({ consumo_kwh_mes: 3 }).consumo_mes_kwh).toBeNull()
    expect(interpretarLeituraConta({ consumo_kwh_mes: 80000 }).consumo_mes_kwh).toBeNull()
  })

  it('lixo na entrada devolve tudo nulo em vez de quebrar', () => {
    const l = interpretarLeituraConta(null)
    expect(l.consumo_medio_kwh).toBeNull()
    expect(l.tarifa).toBeNull()
  })
})

describe('resumo da leitura da conta', () => {
  it('diz o que veio e o que nao veio', () => {
    const l = interpretarLeituraConta({ consumo_kwh_mes: 500, valor_total: '450,00' })
    expect(resumoDaLeituraConta(l)).toContain('consumo médio')
    expect(resumoDaLeituraConta(l)).toContain('tarifa')
    expect(resumoDaLeituraConta(l)).not.toContain('unidade')
  })

  it('diz quando nao veio nada', () => {
    expect(resumoDaLeituraConta(interpretarLeituraConta({}))).toContain('Não deu para ler')
  })
})

describe('total inflado por coisa que o solar não abate', () => {
  it('COSIP + parcela de acordo não viram tarifa — usa a impressa e avisa', () => {
    // 250 kWh; energia+tributos 262,50; COSIP 25,90; acordo 150,00 = 438,40.
    // A efetiva daria R$ 1,75/kWh e inflaria a economia em ~67%.
    const l = interpretarLeituraConta({
      consumo_kwh_mes: 250,
      valor_total: '438,40',
      tarifa: '1,05',
    })
    expect(l.tarifa).toBe(105)
    expect(l.ressalva).toContain('iluminação pública')
    expect(resumoDaLeituraConta(l)).toContain('iluminação pública')
  })

  it('conta normal: a efetiva com impostos continua valendo', () => {
    // 500 kWh, total 525,00 -> efetiva 1,05; impressa 0,89. 1,05 < 0,89 x 1,7.
    const l = interpretarLeituraConta({
      consumo_kwh_mes: 500,
      valor_total: '525,00',
      tarifa: '0,89',
    })
    expect(l.tarifa).toBe(105)
    expect(l.ressalva).toBeNull()
  })

  it('sem tarifa impressa para comparar, a efetiva passa como antes', () => {
    const l = interpretarLeituraConta({ consumo_kwh_mes: 250, valor_total: '438,40' })
    expect(l.tarifa).toBe(175)
    expect(l.ressalva).toBeNull()
  })

  it('tarifa impressa com seis casas e ponto decimal é lida certo', () => {
    const l = interpretarLeituraConta({ consumo_kwh_mes: 500, tarifa: '0.867459' })
    expect(l.tarifa).toBe(87)
  })
})
