'use client'

import { useRef, useState } from 'react'
import { useMesclaDaLeitura } from '@/components/mescla-leitura'
import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { gerarPropostaExpressa } from './acoes'
import { lerContaDeEnergia } from './acoes-leitura'
import { formatarValor } from '@/lib/format'

const TELHADOS = ['cerâmica', 'fibrocimento', 'metálico', 'laje', 'solo']

/**
 * Todo campo que vive dentro de uma secao que remonta com a leitura.
 *
 * WhatsApp e CPF entram aqui mesmo sem a leitura os preencher: eles moram na
 * mesma secao que renasce, e ficar de fora era o que os apagava em silencio.
 */
type Nome =
  | 'consumo_medio'
  | 'tarifa'
  | 'tipo_ligacao'
  | 'uc'
  | 'cliente_nome'
  | 'cliente_telefone'
  | 'cliente_documento'

const INICIAIS: Record<Nome, string> = {
  consumo_medio: '',
  tarifa: '',
  tipo_ligacao: 'monofasica',
  uc: '',
  cliente_nome: '',
  cliente_telefone: '',
  cliente_documento: '',
}

export function FormularioExpresso({
  clientes,
  concessionariaPadrao,
  leituraDisponivel,
}: {
  clientes: { id: string; nome: string; telefone: string | null }[]
  concessionariaPadrao: string
  leituraDisponivel: boolean
}) {
  const [clienteId, setClienteId] = useState('')
  const novoCliente = clienteId === ''

  // Campos nao-controlados: quando a leitura chega, a secao renasce com a
  // mescla. Quem mexeu manda; o resto recebe o que veio da conta.
  const { valores, versao, ancoraRef, aplicar } = useMesclaDaLeitura(INICIAIS)
  const [fotos, setFotos] = useState<string[]>([])
  const fotosRef = useRef<string[]>([])
  const [lendo, setLendo] = useState(false)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  async function preencherPelaConta() {
    const assinatura = fotos.join('|')

    setLendo(true)
    setAviso(null)
    try {
      const r = await lerContaDeEnergia({ caminhos: fotos })

      if (assinatura !== fotosRef.current.join('|')) {
        setAviso({ tom: 'erro', texto: 'Os anexos mudaram durante a leitura. Aperte de novo.' })
        return
      }
      if (r.erro || !r.leitura) {
        setAviso({ tom: 'erro', texto: r.erro ?? 'A leitura automática falhou. Preencha à mão.' })
        return
      }

      const l = r.leitura
      aplicar({
        consumo_medio: l.consumo_medio_kwh !== null ? String(l.consumo_medio_kwh) : null,
        tarifa: l.tarifa !== null ? formatarValor(l.tarifa) : null,
        tipo_ligacao: l.tipo_ligacao,
        uc: l.uc,
        cliente_nome: l.cliente_nome,
      })
      setAviso({ tom: 'ok', texto: r.resumo ?? 'Leitura aplicada. Confira antes de gerar.' })
    } catch {
      setAviso({ tom: 'erro', texto: 'A leitura automática falhou. Preencha à mão.' })
    } finally {
      setLendo(false)
    }
  }

  return (
    <FormularioAcao
      acao={gerarPropostaExpressa}
      className="space-y-3"
      rotuloBotao="Gerar a proposta"
    >
      {/* 1. De quem é a conta */}
      <div className="rounded border border-slate-300 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          1. De quem é a conta
        </p>

        <label className="block">
          <span className="rotulo">Cliente</span>
          <select
            className="campo"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">— cliente novo, cadastrar agora —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        {novoCliente && (
          <div key={`cliente-${versao}`} className="mt-2 space-y-2">
            <Campo
              rotulo="Nome do cliente"
              nome="cliente_nome"
              valor={valores.cliente_nome || undefined}
              obrigatorio
            />
            <div className="grid grid-cols-2 gap-2">
              <Campo
                rotulo="WhatsApp"
                nome="cliente_telefone"
                inputMode="tel"
                placeholder="(86) 99999-9999"
                valor={valores.cliente_telefone || undefined}
                dica="Para enviar a proposta"
              />
              <Campo
                rotulo="CPF/CNPJ"
                nome="cliente_documento"
                valor={valores.cliente_documento || undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. A conta de energia */}
      <div ref={ancoraRef} className="rounded border border-rv-600 bg-rv-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rv-800 mb-2">
          2. A conta de energia
        </p>
        <CapturaFoto
          bucket="arquivos"
          obraId={clienteId || 'novos-clientes'}
          pasta="contas-de-energia"
          nomeCampo="anexo"
          rotulo="Fotografar a conta"
          aoMudar={(f) => {
            const caminhos = f.map((x) => x.caminho)
            setFotos(caminhos)
            fotosRef.current = caminhos
            // Resumo ou erro de uma tentativa antiga nao descreve estes anexos.
            setAviso(null)
          }}
        />
        {fotos.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-600">
            A conta fica guardada junto ao cliente.
            {leituraDisponivel
              ? ' Com ela anexada, dá para preencher os números sozinho.'
              : ' Os números abaixo você lê nela.'}
          </p>
        )}

        {leituraDisponivel && (fotos.length > 0 || lendo || aviso) && (
          <div className="mt-2 border-t border-rv-100 pt-2">
            <button
              type="button"
              className="botao botao-primario"
              disabled={lendo || fotos.length === 0}
              onClick={preencherPelaConta}
            >
              {lendo ? 'Lendo a conta…' : 'Preencher pela conta'}
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

      {/* 3. O que a conta diz */}
      <div key={`conta-${versao}`} className="rounded border border-slate-300 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          3. O que está na conta
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Campo
            rotulo="Consumo médio (kWh)"
            nome="consumo_medio"
            inputMode="decimal"
            obrigatorio
            placeholder="500"
            valor={valores.consumo_medio || undefined}
            dica="A média dos 12 meses"
          />
          <Campo
            rotulo="Tarifa (R$/kWh)"
            nome="tarifa"
            inputMode="decimal"
            obrigatorio
            placeholder="1,00"
            valor={valores.tarifa || undefined}
            dica="Com impostos"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Selecao
            rotulo="Ligação"
            nome="tipo_ligacao"
            valor={valores.tipo_ligacao}
            opcoes={[
              { valor: 'monofasica', rotulo: 'Monofásica' },
              { valor: 'bifasica', rotulo: 'Bifásica' },
              { valor: 'trifasica', rotulo: 'Trifásica' },
            ]}
          />
          <Campo rotulo="Unidade consumidora" nome="uc" valor={valores.uc || undefined} />
        </div>
        <input type="hidden" name="concessionaria" value={concessionariaPadrao} />
      </div>

      {/* 4. Da obra (opcional) */}
      <details className="rounded border border-slate-300 bg-white px-3">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-rv-800">
          Telhado e distância (opcional)
        </summary>
        <div className="grid grid-cols-2 gap-2 pb-3">
          <Selecao
            rotulo="Tipo de telhado"
            nome="tipo_telhado"
            vazio="— não informado —"
            opcoes={TELHADOS.map((t) => ({ valor: t, rotulo: t }))}
          />
          <Campo
            rotulo="Distância do quadro (m)"
            nome="distancia_quadro"
            inputMode="decimal"
            valor="20"
          />
        </div>
      </details>
    </FormularioAcao>
  )
}
