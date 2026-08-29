'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { pedirRecuperacao } from './acoes'

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-primario w-full" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar o link'}
    </button>
  )
}

export function FormularioRecuperacao() {
  const [estado, acao] = useActionState(pedirRecuperacao, null)

  return (
    <form action={acao} className="space-y-3">
      <div>
        <label className="rotulo" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="campo"
          placeholder="voce@rvengenharia.com"
        />
      </div>
      {estado?.erro && (
        <p className="text-sm rounded border border-erro-700/30 bg-erro-100 text-erro-700 px-3 py-2">
          {estado.erro}
        </p>
      )}
      {estado?.ok && (
        <p className="text-sm rounded border border-ok-700/30 bg-ok-100 text-ok-700 px-3 py-2">
          {estado.ok}
        </p>
      )}
      <Botao />
    </form>
  )
}
