'use client'

import { FormularioAcao, Campo, Selecao, AreaTexto } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { lancarMedicao, salvarServico, salvarServicoTerceiro } from './acoes'
import { formatarValor, hojeISO } from '@/lib/format'
import { ROTULO_UNIDADE, type ServicoApurado } from '@/lib/domain/medicoes'

const UNIDADES = Object.entries(ROTULO_UNIDADE).map(([valor, rotulo]) => ({ valor, rotulo }))

export function FormularioServico({
  obraId,
  servico,
}: {
  obraId: string
  servico: ServicoApurado | null
}) {
  return (
    <FormularioAcao acao={salvarServico} className="space-y-2" rotuloBotao="Salvar serviço">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value={servico?.id ?? ''} />

      <Campo
        rotulo="Descrição do serviço"
        nome="descricao"
        valor={servico?.descricao}
        obrigatorio
        placeholder="Forro em gesso acartonado"
      />
      <div className="grid grid-cols-2 gap-2">
        <Selecao
          rotulo="Unidade"
          nome="unidade"
          valor={String(servico?.unidade ?? 'm2')}
          opcoes={UNIDADES}
        />
        <Campo
          rotulo="Quantidade contratada"
          nome="quantidade_contratada"
          inputMode="decimal"
          valor={servico?.quantidade_contratada ?? ''}
          placeholder="101,94"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Custo unitário"
          nome="custo_unitario"
          inputMode="decimal"
          valor={servico?.custo_unitario ? formatarValor(servico.custo_unitario) : ''}
          placeholder="66,74"
          dica="Material + mão de obra. Interno."
        />
        <Campo
          rotulo="Preço de venda unitário"
          nome="preco_venda_unitario"
          inputMode="decimal"
          valor={servico ? formatarValor(servico.preco_venda_unitario) : ''}
          placeholder="90,00"
          obrigatorio
          dica="É o que vai ao cliente."
        />
      </div>
    </FormularioAcao>
  )
}

export function FormularioMedicao({
  obraId,
  servicos,
  locais,
}: {
  obraId: string
  servicos: { id: string; descricao: string; unidade: string; saldo: number | null }[]
  locais: { id: string; nome: string }[]
}) {
  return (
    <FormularioAcao acao={lancarMedicao} className="space-y-2" rotuloBotao="Lançar medição">
      <input type="hidden" name="obra_id" value={obraId} />
      <Selecao
        rotulo="Serviço"
        nome="servico_id"
        vazio="— selecione —"
        obrigatorio
        opcoes={servicos.map((s) => ({
          valor: s.id,
          rotulo: `${s.descricao}${s.saldo !== null ? ` (faltam ${s.saldo})` : ''}`,
        }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Data" nome="data" tipo="date" valor={hojeISO()} />
        <Campo rotulo="Quantidade executada" nome="quantidade" inputMode="decimal" obrigatorio />
      </div>
      {locais.length > 0 && (
        <Selecao
          rotulo="Local"
          nome="local_id"
          vazio="— obra inteira —"
          opcoes={locais.map((l) => ({ valor: l.id, rotulo: l.nome }))}
        />
      )}
      <AreaTexto rotulo="Observação" nome="observacao" linhas={2} />
    </FormularioAcao>
  )
}

export function FormularioTerceiro({
  obraId,
  terceiros,
}: {
  obraId: string
  terceiros: { id: string; nome: string; atividade: string | null }[]
}) {
  return (
    <FormularioAcao acao={salvarServicoTerceiro} className="space-y-2" rotuloBotao="Salvar">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value="" />

      <Selecao
        rotulo="Terceiro"
        nome="terceiro_id"
        vazio="— selecione —"
        obrigatorio
        opcoes={terceiros.map((t) => ({
          valor: t.id,
          rotulo: t.atividade ? `${t.nome} (${t.atividade})` : t.nome,
        }))}
      />
      <Campo
        rotulo="Descrição do serviço"
        nome="descricao"
        placeholder="Instalação de forro — R$ 18,00/m²"
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Quantidade" nome="quantidade" inputMode="decimal" />
        <Campo rotulo="Valor combinado" nome="valor_combinado" inputMode="decimal" />
      </div>
      <Campo rotulo="Valor já pago" nome="valor_pago" inputMode="decimal" />
      <div>
        <span className="rotulo">Comprovante</span>
        <CapturaFoto
          bucket="comprovantes"
          obraId={obraId}
          pasta="terceiros"
          nomeCampo="comprovante"
          rotulo="Fotografar comprovante"
        />
      </div>
    </FormularioAcao>
  )
}
