import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarProjetoSolar } from '@/lib/dados/solar'
import { calcularEconomia, projetar25Anos } from '@/lib/domain/solar'
import { itensParaProposta } from '@/lib/domain/proposta-solar'
import { carregarParametros, dadosEmpresa, texto } from '@/lib/parametros'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { EnviarWhatsApp } from '@/components/enviar-whatsapp'
import { formatarData, formatarMoeda, formatarNumero, formatarPercentual, hojeISO } from '@/lib/format'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Proposta de energia solar (spec 5.7), nas dez secoes pedidas.
 *
 * O que esta pagina NAO mostra, por regra: preco de fornecedor, custo item a
 * item e margem. Os equipamentos saem descritos com quantidade, e o valor e
 * global — e o caso 30 da especificacao.
 */
export default async function PropostaSolar({
  params,
  searchParams,
}: {
  params: Promise<{ projetoId: string }>
  searchParams: Promise<{ nova?: string }>
}) {
  const { projetoId } = await params
  const { nova } = await searchParams
  await exigirAdmin()

  const [dados, parametros] = await Promise.all([
    carregarProjetoSolar(projetoId),
    carregarParametros(),
  ])
  if (!dados) notFound()

  const { projeto, dimensionamento: d, cotacao, percentual_fio_b, tarifa_fio_b } = dados
  const empresa = dadosEmpresa(parametros)

  // Valor congelado manda; sem ele, o calculo do momento.
  const investimento = projeto.preco_venda ?? cotacao.preco_venda
  const economia = calcularEconomia({
    dimensionamento: d,
    tarifa: projeto.tarifa,
    tarifa_fio_b,
    percentual_fio_b,
    investimento_total: investimento,
  })
  const projecao = projetar25Anos(
    {
      dimensionamento: d,
      tarifa: projeto.tarifa,
      tarifa_fio_b,
      percentual_fio_b,
      investimento_total: investimento,
    },
    undefined,
    25,
  )
  const acumulado25 = projecao.at(-1)?.acumulado ?? 0

  const consumo = projeto.consumo_mensal
  const maiorConsumo = Math.max(1, ...consumo)
  const equipamentos = itensParaProposta(cotacao)

  if (d.aviso) {
    return (
      <>
        <BarraImpressao>
          <Link href={`/solar/${projetoId}`} className="botao botao-neutro">
            Voltar
          </Link>
        </BarraImpressao>
        <div className="folha">
          <p className="text-sm text-erro-700 font-medium">{d.aviso}</p>
          <p className="mt-2 text-sm text-slate-600">
            Sem energia a compensar não há proposta a gerar.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <BarraImpressao>
        <Link href={`/solar/${projetoId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir rotulo="Salvar em PDF" />
        <EnviarWhatsApp
          telefone={projeto.cliente_telefone}
          nomeCliente={projeto.cliente_nome}
          potencia={`${formatarNumero(d.potencia_instalada_kwp, 2)} kWp`}
          economiaMes={formatarMoeda(economia.economia_liquida_mes)}
          investimento={formatarMoeda(investimento)}
          empresa={empresa.nome}
        />
        <Link href={`/api/solar/${projetoId}/planilha`} className="botao botao-neutro">
          Planilha (xlsx)
        </Link>
      </BarraImpressao>

      {nova === '1' && (
        <div className="nao-imprimir mx-auto my-3 max-w-[210mm] rounded border border-ok-700/40 bg-ok-100 px-3 py-2">
          <p className="text-sm font-bold text-ok-700">Proposta pronta.</p>
          <p className="text-xs text-ok-700 mt-0.5">
            Para mandar ao cliente: <strong>Salvar em PDF</strong> e depois{' '}
            <strong>Enviar pelo WhatsApp</strong>, anexando o arquivo salvo. Os valores ficaram
            congelados neste projeto.
          </p>
        </div>
      )}

      <Documento
        empresa={empresa}
        titulo="Proposta de energia solar"
        subtitulo="Sistema fotovoltaico conectado à rede"
        geradoEm={new Date()}
        cabecalho={
          <BlocoDados
            itens={[
              { rotulo: 'Cliente', valor: projeto.cliente_nome },
              ...(projeto.cliente_documento
                ? [{ rotulo: 'CPF/CNPJ', valor: projeto.cliente_documento }]
                : []),
              { rotulo: 'Unidade', valor: projeto.uc ?? '—' },
              { rotulo: 'Concessionária', valor: projeto.concessionaria ?? '—' },
              { rotulo: 'Ligação', valor: projeto.tipo_ligacao },
              { rotulo: 'Data', valor: formatarData(hojeISO()) },
            ]}
          />
        }
      >
        {/* 2. Diagnóstico do consumo */}
        <h2 className="text-[11px] font-bold uppercase text-rv-900 mt-2 mb-1">
          Diagnóstico do consumo
        </h2>
        <table className="tabela">
          <tbody>
            <tr>
              <td>Consumo médio mensal</td>
              <td className="num">{formatarNumero(d.consumo_medio_mensal, 0)} kWh</td>
              <td>Custo de disponibilidade</td>
              <td className="num">{d.custo_disponibilidade} kWh</td>
            </tr>
            <tr>
              <td>Energia a compensar</td>
              <td className="num">{formatarNumero(d.energia_a_compensar, 0)} kWh/mês</td>
              <td>Tarifa considerada</td>
              <td className="num">{formatarMoeda(projeto.tarifa)}/kWh</td>
            </tr>
          </tbody>
        </table>

        {consumo.length > 1 && (
          <div className="mt-2 border border-slate-300 rounded p-2">
            <div className="flex items-end gap-1 h-20">
              {consumo.map((kwh, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-0.5">
                  <div
                    className="w-full bg-rv-700"
                    style={{ height: `${Math.max(4, (kwh / maiorConsumo) * 100)}%` }}
                    title={`${kwh} kWh`}
                  />
                  <span className="text-[7px] text-slate-600">{MESES[i]}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[9px] text-slate-600 text-center">
              Consumo dos últimos 12 meses, em kWh
            </p>
          </div>
        )}

        {/* 3. Sistema proposto */}
        <h2 className="text-[11px] font-bold uppercase text-rv-900 mt-3 mb-1">Sistema proposto</h2>
        <table className="tabela">
          <tbody>
            <tr>
              <td>Potência instalada</td>
              <td className="num">{formatarNumero(d.potencia_instalada_kwp, 2)} kWp</td>
              <td>Quantidade de módulos</td>
              <td className="num">{d.qtd_modulos}</td>
            </tr>
            <tr>
              <td>Inversor</td>
              <td className="num">{formatarNumero(d.potencia_inversor_kw, 2)} kW</td>
              <td>Área necessária</td>
              <td className="num">{formatarNumero(d.area_necessaria_m2, 2)} m²</td>
            </tr>
            <tr>
              <td>Tipo de telhado</td>
              <td className="num">{projeto.tipo_telhado ?? '—'}</td>
              <td>Cobertura do consumo</td>
              <td className="num">{formatarPercentual(d.cobertura_consumo, 0)}</td>
            </tr>
          </tbody>
        </table>

        {/* 4. Geração estimada mês a mês */}
        <h2 className="text-[11px] font-bold uppercase text-rv-900 mt-3 mb-1">
          Geração estimada mês a mês
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              {MESES.map((m) => (
                <th key={m} className="num">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {MESES.map((m) => (
                <td key={m} className="num">
                  {formatarNumero(d.geracao_mensal_estimada, 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="text-[9px] text-slate-600 mt-0.5">
          Estimativa em kWh, calculada com HSP de Teresina e desempenho do sistema.
        </p>

        {/* 5. Economia e payback */}
        <h2 className="text-[11px] font-bold uppercase text-rv-900 mt-3 mb-1">
          Economia e retorno do investimento
        </h2>
        <table className="tabela">
          <tbody>
            <tr>
              <td>Economia mensal estimada</td>
              <td className="num">{formatarMoeda(economia.economia_liquida_mes)}</td>
            </tr>
            <tr>
              <td>Economia no primeiro ano</td>
              <td className="num">{formatarMoeda(economia.economia_ano_1)}</td>
            </tr>
            <tr>
              <td>Economia acumulada em 25 anos</td>
              <td className="num">{formatarMoeda(acumulado25)}</td>
            </tr>
            <tr className="subtotal">
              <td>Retorno do investimento</td>
              <td className="num">
                {economia.payback_anos
                  ? `${formatarNumero(economia.payback_anos, 1)} anos`
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-[9px] text-slate-600 mt-0.5">
          A projeção considera a degradação natural dos módulos e a cobrança gradual do Fio B,
          conforme a Lei 14.300/2022.
        </p>

        {/* 6. Equipamentos e serviços — sem preço item a item */}
        <h2 className="text-[11px] font-bold uppercase text-rv-900 mt-3 mb-1">
          Equipamentos e serviços inclusos
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((e, i) => (
              <tr key={i}>
                <td>{e.descricao}</td>
                <td className="num">{e.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 7. Investimento */}
        <table className="tabela mt-3">
          <tbody>
            <tr className="total">
              <td>Investimento total</td>
              <td className="num">{formatarMoeda(investimento)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] mt-1">
          <strong>Formas de pagamento:</strong> à vista, ou parcelado conforme condições a combinar.
          {projeto.status === 'enviado' || projeto.status === 'cotado' ? '' : ''}{' '}
          <strong>Validade da proposta:</strong> {texto(parametros, 'texto_validade')}
        </p>

        {/* 8 e 9. Garantias e o que não está incluso */}
        <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
          <div>
            <strong className="block uppercase text-rv-900">Garantias</strong>
            Módulos: 12 anos contra defeito de fabricação e 25 anos de eficiência. Inversor: 5 anos
            de fábrica. Instalação: 1 ano.
          </div>
          <div>
            <strong className="block uppercase text-rv-900">O que não está incluso</strong>
            {texto(parametros, 'texto_nao_incluso')} Reforço estrutural do telhado, adequação do
            padrão de entrada e obras civis não descritas nesta proposta.
          </div>
        </div>
      </Documento>
    </>
  )
}
