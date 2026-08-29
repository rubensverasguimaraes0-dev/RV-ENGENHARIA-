'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { trocarSenha } from './acoes'

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-primario w-full" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar a nova senha'}
    </button>
  )
}

export function FormularioNovaSenha() {
  const [estado, acao] = useActionState(trocarSenha, null)

  return (
    <form action={acao} className="space-y-3">
      <div>
        <label className="rotulo" htmlFor="senha">
          Nova senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="campo"
        />
        <p className="text-[11px] text-slate-500 mt-1">Pelo menos 8 caracteres.</p>
      </div>
      <div>
        <label className="rotulo" htmlFor="confirmacao">
          Repita a nova senha
        </label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
