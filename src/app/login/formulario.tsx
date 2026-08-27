'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrar } from './acoes'

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-primario w-full" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

export function FormularioLogin({ proximo }: { proximo: string }) {
  const [estado, acao] = useActionState(entrar, null)

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="proximo" value={proximo} />
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
      <div>
        <label className="rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
        />
      </div>
      {estado?.erro && (
        <p className="text-sm rounded border border-erro-700/30 bg-erro-100 text-erro-700 px-3 py-2">
          {estado.erro}
        </p>
      )}
      <Botao />
    </form>
  )
}
