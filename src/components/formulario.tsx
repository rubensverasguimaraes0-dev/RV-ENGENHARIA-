'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { EstadoForm } from '@/lib/form'

export function BotaoSalvar({ rotulo = 'Salvar' }: { rotulo?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-primario" disabled={pending}>
      {pending ? 'Salvando…' : rotulo}
    </button>
  )
}

/**
 * Formulario com server action e mensagem de retorno. Funciona sem JavaScript;
 * o estado so melhora a resposta quando ha JS (obra tem sinal ruim).
 */
export function FormularioAcao({
  acao,
  children,
  className,
  rotuloBotao,
  aoConcluir,
}: {
  acao: (estado: EstadoForm | null, form: FormData) => Promise<EstadoForm>
  children: React.ReactNode
  className?: string
  rotuloBotao?: string
  aoConcluir?: (estado: EstadoForm) => void
}) {
  const [estado, despachar] = useActionState(
    async (e: EstadoForm | null, f: FormData) => {
      const r = await acao(e, f)
      if (r.ok && aoConcluir) aoConcluir(r)
      return r
    },
    null,
  )

  return (
    <form action={despachar} className={className}>
      {children}
      <div className="flex items-center gap-3 flex-wrap mt-3">
        <BotaoSalvar rotulo={rotuloBotao} />
        {estado?.erro && <span className="text-sm text-erro-700 font-medium">{estado.erro}</span>}
        {estado?.ok && <span className="text-sm text-ok-700 font-medium">{estado.ok}</span>}
      </div>
    </form>
  )
}

export function Campo({
  rotulo,
  nome,
  tipo = 'text',
  valor,
  obrigatorio,
  placeholder,
  dica,
  inputMode,
  lista,
}: {
  rotulo: string
  nome: string
  tipo?: string
  valor?: string | number | null
  obrigatorio?: boolean
  placeholder?: string
  dica?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'
  lista?: string
}) {
  return (
    <label className="block">
      <span className="rotulo">
        {rotulo}
        {obrigatorio && <span className="text-erro-700"> *</span>}
      </span>
      <input
        className="campo"
        name={nome}
        type={tipo}
        defaultValue={valor ?? ''}
        required={obrigatorio}
        placeholder={placeholder}
        inputMode={inputMode}
        list={lista}
      />
      {dica && <span className="block text-[11px] text-slate-500 mt-0.5">{dica}</span>}
    </label>
  )
}

export function Selecao({
  rotulo,
  nome,
  valor,
  opcoes,
  vazio,
  obrigatorio,
  dica,
}: {
  rotulo: string
  nome: string
  valor?: string | null
  opcoes: { valor: string; rotulo: string }[]
  vazio?: string
  obrigatorio?: boolean
  dica?: string
}) {
  return (
    <label className="block">
      <span className="rotulo">
        {rotulo}
        {obrigatorio && <span className="text-erro-700"> *</span>}
      </span>
      <select className="campo" name={nome} defaultValue={valor ?? ''} required={obrigatorio}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {dica && <span className="block text-[11px] text-slate-500 mt-0.5">{dica}</span>}
    </label>
  )
}

export function AreaTexto({
  rotulo,
  nome,
  valor,
  linhas = 3,
  dica,
}: {
  rotulo: string
  nome: string
  valor?: string | null
  linhas?: number
  dica?: string
}) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <textarea className="campo" name={nome} rows={linhas} defaultValue={valor ?? ''} />
      {dica && <span className="block text-[11px] text-slate-500 mt-0.5">{dica}</span>}
    </label>
  )
}

export function Marcador({
  rotulo,
  nome,
  marcado,
  dica,
}: {
  rotulo: string
  nome: string
  marcado?: boolean
  dica?: string
}) {
  return (
    <label className="flex items-start gap-2 py-1">
      <input type="checkbox" name={nome} defaultChecked={marcado} className="mt-1 h-4 w-4" />
      <span>
        <span className="text-sm font-medium">{rotulo}</span>
        {dica && <span className="block text-[11px] text-slate-500">{dica}</span>}
      </span>
    </label>
  )
}
