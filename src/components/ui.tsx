import Link from 'next/link'
import { formatarMoeda, type Centavos } from '@/lib/format'

export function TituloPagina({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string
  subtitulo?: React.ReactNode
  acoes?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
      <div>
        <h1 className="text-lg font-bold text-rv-900">{titulo}</h1>
        {subtitulo && <div className="text-sm text-slate-600">{subtitulo}</div>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2 nao-imprimir">{acoes}</div>}
    </div>
  )
}

export function Cartao({
  titulo,
  children,
  acoes,
}: {
  titulo: string
  children: React.ReactNode
  acoes?: React.ReactNode
}) {
  return (
    <section className="cartao overflow-hidden">
      <div className="cartao-titulo flex items-center justify-between gap-2">
        <span>{titulo}</span>
        {acoes}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

/** Numero grande de painel — o valor total nunca sai em fonte muito grande (spec 12). */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'ok' | 'alerta' | 'erro'
}) {
  const cores = {
    neutro: 'text-rv-900',
    ok: 'text-ok-700',
    alerta: 'text-alerta-700',
    erro: 'text-erro-700',
  }[tom]
  return (
    <div className="border border-slate-300 rounded bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {rotulo}
      </div>
      <div className={`text-base font-bold tabular-nums ${cores}`}>{valor}</div>
      {detalhe && <div className="text-[11px] text-slate-500">{detalhe}</div>}
    </div>
  )
}

export function Moeda({ valor }: { valor: Centavos | null | undefined }) {
  return <span className="tabular-nums">{formatarMoeda(valor ?? 0)}</span>
}

export function Etiqueta({
  children,
  tom = 'neutra',
}: {
  children: React.ReactNode
  tom?: 'neutra' | 'ok' | 'alerta' | 'erro'
}) {
  return <span className={`etiqueta etiqueta-${tom}`}>{children}</span>
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded p-4 text-center">
      {children}
    </p>
  )
}

export function BotaoLink({
  href,
  children,
  variante = 'neutro',
  ...rest
}: {
  href: string
  children: React.ReactNode
  variante?: 'primario' | 'neutro' | 'perigo'
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'children'>) {
  return (
    <Link href={href} className={`botao botao-${variante}`} {...rest}>
      {children}
    </Link>
  )
}
