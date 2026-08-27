'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormularioAcao, Campo, Selecao, AreaTexto, Marcador } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { salvarNota } from '../acoes'
import { hojeISO } from '@/lib/format'

export function FormularioNota({
  obraId,
  fornecedores,
  locais,
  ehAdmin,
}: {
  obraId: string
  fornecedores: { id: string; nome: string }[]
  locais: { id: string; nome: string }[]
  ehAdmin: boolean
}) {
  const router = useRouter()
  const [temFoto, setTemFoto] = useState(false)

  return (
    <FormularioAcao
      acao={salvarNota}
      className="space-y-3"
      rotuloBotao="Lançar nota"
      aoConcluir={() => router.push(`/obras/${obraId}/notas`)}
    >
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value="" />

      <div className="rounded border border-rv-600 bg-rv-50 p-3">
        <span className="rotulo">1. Foto da nota</span>
        <CapturaFoto
          bucket="notas-fiscais"
          obraId={obraId}
          pasta="notas"
          aoMudar={(f) => setTemFoto(f.length > 0)}
        />
        {!temFoto && (
          <p className="mt-1 text-[11px] text-alerta-700 font-medium">
            Nota sem foto não entra em relatório enviado ao cliente.
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Campo rotulo="Data" nome="data" tipo="date" valor={hojeISO()} obrigatorio />
        <Campo
          rotulo="Valor"
          nome="valor"
          inputMode="decimal"
          placeholder="476,40"
          obrigatorio
        />
      </div>

      <Selecao
        rotulo="Fornecedor"
        nome="fornecedor_id"
        vazio="— não cadastrado —"
        opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.nome }))}
      />
      <Campo
        rotulo="Ou digite o fornecedor"
        nome="fornecedor_nome"
        placeholder="Loja ainda não cadastrada"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Campo rotulo="Número da nota / NFC-e" nome="numero_nota" />
        <Selecao
          rotulo="Categoria"
          nome="categoria"
          valor="material"
          opcoes={[
            { valor: 'material', rotulo: 'Material' },
            { valor: 'locacao', rotulo: 'Locação de equipamento' },
            { valor: 'cacamba', rotulo: 'Caçamba de entulho' },
            { valor: 'terceiro', rotulo: 'Serviço de terceiro' },
            { valor: 'combustivel', rotulo: 'Combustível' },
            { valor: 'outro', rotulo: 'Outro' },
          ]}
        />
      </div>

      <Campo
        rotulo="O que foi comprado"
        nome="descricao"
        placeholder="cimento, areia e brita"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Selecao
          rotulo="Forma de pagamento"
          nome="forma_pagamento"
          vazio="— selecione —"
          opcoes={['pix', 'dinheiro', 'cartão', 'transferência', 'boleto', 'prazo'].map((f) => ({
            valor: f,
            rotulo: f,
          }))}
        />
        <Selecao
          rotulo="Quem pagou"
          nome="pago_por"
          valor="rv"
          opcoes={[
            { valor: 'rv', rotulo: 'RV Engenharia (a repassar)' },
            { valor: 'cliente', rotulo: 'O cliente na loja (não repassar)' },
          ]}
          dica="Nota paga pelo cliente sai em seção separada e não soma no valor a repassar."
        />
      </div>

      {locais.length > 0 && (
        <Selecao
          rotulo="Local da obra"
          nome="local_id"
          vazio="— obra inteira —"
          opcoes={locais.map((l) => ({ valor: l.id, rotulo: l.nome }))}
          dica="Depois de salvar, dá para dividir a nota entre dois locais na tela de notas."
        />
      )}

      {ehAdmin && (
        <>
          <AreaTexto
            rotulo="Anotação interna"
            nome="anotacao_interna"
            linhas={2}
            dica='Ex.: "ANT-PAULO", "Campeão (Rubens)". Nunca sai em documento do cliente.'
          />
          <Marcador
            rotulo="Local a confirmar"
            nome="a_confirmar"
            dica="O app avisa antes de gerar o relatório enquanto isso não for resolvido."
          />
        </>
      )}
    </FormularioAcao>
  )
}
