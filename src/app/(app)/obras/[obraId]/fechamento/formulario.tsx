'use client'

import { FormularioAcao, Campo, Selecao, AreaTexto, Marcador } from '@/components/formulario'
import { salvarServicoExecutado } from './acoes'
import { formatarValor } from '@/lib/format'
import type { ServicoExecutado } from '@/lib/domain/fechamento-debitos'

const FRENTES = ['Obras civis', 'Elétrica', 'Hidráulica', 'Pintura', 'Gesso e forro', 'Serviços gerais']

export function FormularioServicoExecutado({
  obraId,
  servico,
  locais,
  proximaOrdem,
}: {
  obraId: string
  servico: ServicoExecutado | null
  locais: { id: string; nome: string }[]
  proximaOrdem: number
}) {
  return (
    <FormularioAcao acao={salvarServicoExecutado} className="space-y-2" rotuloBotao="Salvar serviço">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value={servico?.id ?? ''} />
      <input type="hidden" name="ordem" value={servico?.ordem ?? proximaOrdem} />

      <Campo rotulo="Descrição do serviço" nome="descricao" valor={servico?.descricao} obrigatorio />
      <Selecao
        rotulo="Frente de trabalho"
        nome="grupo"
        valor={servico?.grupo ?? 'Obras civis'}
        opcoes={FRENTES.map((f) => ({ valor: f, rotulo: f }))}
        dica="Vira o grupo com subtotal no relatório."
      />
      {locais.length > 0 && (
        <Selecao
          rotulo="Local"
          nome="local_id"
          valor={servico?.local_id}
          vazio="— obra inteira —"
          opcoes={locais.map((l) => ({ valor: l.id, rotulo: l.nome }))}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Quantidade"
          nome="quantidade"
          inputMode="decimal"
          valor={servico?.quantidade ?? ''}
          dica="Opcional; habilita o preço unitário"
        />
        <Campo rotulo="Unidade" nome="unidade" valor={servico?.unidade ?? ''} placeholder="m², m, un" />
      </div>
      <Campo
        rotulo="Valor do serviço"
        nome="valor"
        inputMode="decimal"
        valor={servico ? formatarValor(servico.valor) : ''}
        obrigatorio
      />

      <div className="rounded border border-slate-300 bg-slate-50 p-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Deduções</p>
        <Marcador
          rotulo="Serviço foi executado"
          nome="executado"
          marcado={servico?.executado ?? true}
          dica="Desmarcado, o valor inteiro entra como dedução no fechamento."
        />
        <Campo
          rotulo="Dedução parcial"
          nome="valor_deducao"
          inputMode="decimal"
          valor={servico?.valor_deducao ? formatarValor(servico.valor_deducao) : ''}
          dica="Para serviço executado só em parte."
        />
        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa_deducao"
          linhas={2}
          valor={servico?.justificativa_deducao}
          dica="Sai esclarecida ao final do relatório."
        />
      </div>
    </FormularioAcao>
  )
}
