'use client'

import { useRef, useState } from 'react'
import { useMesclaDaLeitura } from '@/components/mescla-leitura'
import { useRouter } from 'next/navigation'
import { FormularioAcao, Campo, Selecao, AreaTexto, Marcador } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { salvarNota } from '../acoes'
import { lerFotoDaNota } from './acoes-leitura'
import { formatarValor, hojeISO } from '@/lib/format'

/** Todo campo que vive dentro da secao que remonta com a leitura. */
type Nome =
  | 'data'
  | 'valor'
  | 'fornecedor_id'
  | 'fornecedor_nome'
  | 'numero_nota'
  | 'categoria'
  | 'descricao'
  | 'forma_pagamento'
  | 'pago_por'

const INICIAIS: Record<Nome, string> = {
  data: hojeISO(),
  valor: '',
  fornecedor_id: '',
  fornecedor_nome: '',
  numero_nota: '',
  categoria: 'material',
  descricao: '',
  forma_pagamento: '',
  pago_por: 'rv',
}

export function FormularioNota({
  obraId,
  fornecedores,
  locais,
  ehAdmin,
  leituraDisponivel,
}: {
  obraId: string
  fornecedores: { id: string; nome: string }[]
  locais: { id: string; nome: string }[]
  ehAdmin: boolean
  leituraDisponivel: boolean
}) {
  const router = useRouter()

  // Campos nao-controlados: quando a leitura chega, a secao renasce com a
  // mescla. Quem mexeu manda; o resto recebe o que veio da foto.
  const { valores, versao, ancoraRef, aplicar } = useMesclaDaLeitura(INICIAIS)

  const [fotos, setFotos] = useState<string[]>([])
  const fotosRef = useRef<string[]>([])
  const [lendo, setLendo] = useState(false)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  async function preencherPelaFoto() {
    const assinatura = fotos.join('|')

    setLendo(true)
    setAviso(null)
    try {
      const r = await lerFotoDaNota({ obraId, caminhos: fotos })

      // As fotos mudaram enquanto a IA lia: essa leitura e de outra nota.
      if (assinatura !== fotosRef.current.join('|')) {
        setAviso({ tom: 'erro', texto: 'As fotos mudaram durante a leitura. Aperte de novo.' })
        return
      }
      if (r.erro || !r.leitura) {
        setAviso({ tom: 'erro', texto: r.erro ?? 'A leitura automática falhou. Preencha à mão.' })
        return
      }

      const l = r.leitura
      aplicar({
        data: l.data,
        valor: l.valor !== null ? formatarValor(l.valor) : null,
        fornecedor_id: l.fornecedor_id,
        fornecedor_nome: l.fornecedor_id ? null : l.fornecedor,
        numero_nota: l.numero_nota,
        categoria: l.categoria,
        descricao: l.descricao,
        forma_pagamento: l.forma_pagamento,
        // pago_por a foto nao sabe: quem pagou e decisao de quem estava la.
      })
      setAviso({ tom: 'ok', texto: r.resumo ?? 'Leitura aplicada. Confira antes de lançar.' })
    } catch {
      setAviso({ tom: 'erro', texto: 'A leitura automática falhou. Preencha à mão.' })
    } finally {
      setLendo(false)
    }
  }

  return (
    <FormularioAcao
      acao={salvarNota}
      className="space-y-3"
      rotuloBotao="Lançar nota"
      aoConcluir={() => router.push(`/obras/${obraId}/notas`)}
    >
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value="" />

      <div ref={ancoraRef} className="rounded border border-rv-600 bg-rv-50 p-3">
        <span className="rotulo">1. Foto da nota</span>
        <CapturaFoto
          bucket="notas-fiscais"
          obraId={obraId}
          pasta="notas"
          aoMudar={(f) => {
            const caminhos = f.map((x) => x.caminho)
            setFotos(caminhos)
            fotosRef.current = caminhos
            // Resumo ou erro de uma tentativa antiga nao descreve estas fotos.
            setAviso(null)
          }}
        />
        {fotos.length === 0 && (
          <p className="mt-1 text-[11px] text-alerta-700 font-medium">
            Nota sem foto não entra em relatório enviado ao cliente.
          </p>
        )}

        {leituraDisponivel && (fotos.length > 0 || lendo || aviso) && (
          <div className="mt-2 border-t border-rv-100 pt-2">
            <button
              type="button"
              className="botao botao-primario"
              disabled={lendo || fotos.length === 0}
              onClick={preencherPelaFoto}
            >
              {lendo ? 'Lendo a nota…' : 'Preencher pela foto'}
            </button>
            {aviso && (
              <p
                className={`mt-1.5 text-[12px] font-medium ${
                  aviso.tom === 'erro' ? 'text-erro-700' : 'text-rv-900'
                }`}
              >
                {aviso.texto}
              </p>
            )}
          </div>
        )}
      </div>

      <div key={versao} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Data" nome="data" tipo="date" valor={valores.data} obrigatorio />
          <Campo
            rotulo="Valor"
            nome="valor"
            inputMode="decimal"
            placeholder="476,40"
            valor={valores.valor || undefined}
            obrigatorio
          />
        </div>

        <Selecao
          rotulo="Fornecedor"
          nome="fornecedor_id"
          vazio="— não cadastrado —"
          valor={valores.fornecedor_id || undefined}
          opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.nome }))}
        />
        <Campo
          rotulo="Ou digite o fornecedor"
          nome="fornecedor_nome"
          placeholder="Loja ainda não cadastrada"
          valor={valores.fornecedor_nome || undefined}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Campo
            rotulo="Número da nota / NFC-e"
            nome="numero_nota"
            valor={valores.numero_nota || undefined}
          />
          <Selecao
            rotulo="Categoria"
            nome="categoria"
            valor={valores.categoria}
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
          valor={valores.descricao || undefined}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Selecao
            rotulo="Forma de pagamento"
            nome="forma_pagamento"
            vazio="— selecione —"
            valor={valores.forma_pagamento || undefined}
            opcoes={['pix', 'dinheiro', 'cartão', 'transferência', 'boleto', 'prazo'].map((f) => ({
              valor: f,
              rotulo: f,
            }))}
          />
          <Selecao
            rotulo="Quem pagou"
            nome="pago_por"
            valor={valores.pago_por}
            opcoes={[
              { valor: 'rv', rotulo: 'RV Engenharia (a repassar)' },
              { valor: 'cliente', rotulo: 'O cliente na loja (não repassar)' },
            ]}
            dica="Nota paga pelo cliente sai em seção separada e não soma no valor a repassar."
          />
        </div>
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
