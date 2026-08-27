'use client'

import { FormularioAcao, Campo, Selecao, Marcador } from '@/components/formulario'
import { registrarSaida, salvarItem } from './acoes'
import { formatarValor, hojeISO } from '@/lib/format'
import type { ItemAlmoxarifado } from '@/lib/domain/almoxarifado'

const CATEGORIAS = ['ELETRICA', 'HIDRAULICA', 'ALVENARIA E PISO', 'ESGOTO', 'PINTURA', 'OUTROS']

export function FormularioItem({
  obraId,
  item,
}: {
  obraId: string
  item: ItemAlmoxarifado | null
}) {
  return (
    <FormularioAcao acao={salvarItem} className="space-y-2" rotuloBotao="Salvar item">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value={item?.id ?? ''} />

      <Selecao
        rotulo="Categoria"
        nome="categoria"
        valor={item?.categoria ?? 'ELETRICA'}
        opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))}
      />
      <Campo
        rotulo="Descrição"
        nome="descricao"
        valor={item?.descricao}
        obrigatorio
        placeholder="CIMENTO CP II 50KG"
        dica="Sai em caixa alta no documento"
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Unidade" nome="unidade" valor={item?.unidade} placeholder="sc, m, un" />
        <Campo
          rotulo="Quantidade"
          nome="quantidade"
          inputMode="decimal"
          valor={item?.quantidade ?? ''}
          dica="Em branco = a contar depois"
        />
      </div>

      <div className="rounded border border-slate-300 bg-slate-50 p-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Só para cabo elétrico
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Campo
            rotulo="Cor e bitola"
            nome="cor_bitola"
            valor={item?.cor_bitola}
            placeholder="vermelho 2,5mm"
          />
          <Campo
            rotulo="Metragem do pedaço"
            nome="metragem"
            inputMode="decimal"
            valor={item?.metragem ?? ''}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Cada pedaço é uma linha. O subtotal por cor e bitola sai sozinho.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Custo unitário"
          nome="custo_unitario"
          inputMode="decimal"
          valor={item?.custo_unitario !== null && item ? formatarValor(item.custo_unitario!) : ''}
          dica="Interno — nunca sai no documento do cliente"
        />
        <Campo
          rotulo="Valor de cobrança"
          nome="valor_cobranca"
          inputMode="decimal"
          valor={item?.valor_cobranca !== null && item ? formatarValor(item.valor_cobranca!) : ''}
          dica="É o que aparece para o cliente"
        />
      </div>
    </FormularioAcao>
  )
}

export function FormularioSaida({
  obraId,
  itens,
}: {
  obraId: string
  itens: { id: string; descricao: string; unidade: string | null; saldo: number | null }[]
}) {
  return (
    <FormularioAcao acao={registrarSaida} className="space-y-2" rotuloBotao="Registrar saída">
      <input type="hidden" name="obra_id" value={obraId} />
      <Selecao
        rotulo="Item"
        nome="item_id"
        vazio="— selecione —"
        obrigatorio
        opcoes={itens.map((i) => ({
          valor: i.id,
          rotulo: `${i.descricao}${i.saldo !== null ? ` (saldo ${i.saldo} ${i.unidade ?? ''})` : ''}`,
        }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Data" nome="data" tipo="date" valor={hojeISO()} />
        <Campo rotulo="Quantidade" nome="quantidade" inputMode="decimal" obrigatorio />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Quem pegou" nome="quem_pegou" />
        <Campo rotulo="Onde usou" nome="onde_usou" />
      </div>
      <Marcador
        rotulo="Cobrar do cliente"
        nome="cobrar_cliente"
        dica="Saídas marcadas entram valoradas no fechamento, pelo valor de cobrança."
      />
    </FormularioAcao>
  )
}
