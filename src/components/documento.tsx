import { Fragment } from 'react'
import type { DadosEmpresa } from '@/lib/parametros'
import { formatarDataHora } from '@/lib/format'

/**
 * Casca de todo documento de cliente (spec 4.17 e 11.3): logo da RV no topo,
 * rodape com os dados da empresa e a assinatura do responsavel tecnico.
 */
export function Documento({
  empresa,
  titulo,
  subtitulo,
  cabecalho,
  children,
  assinar = true,
  geradoEm,
}: {
  empresa: DadosEmpresa
  titulo: string
  subtitulo?: string
  cabecalho?: React.ReactNode
  children: React.ReactNode
  assinar?: boolean
  geradoEm?: Date
}) {
  return (
    <div className="folha text-[12px] text-slate-900">
      <header className="flex items-start justify-between gap-4 border-b-4 border-rv-800 pb-2 mb-3">
        <div className="flex items-center gap-3">
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt={empresa.nome} className="h-14 w-auto object-contain" />
          ) : (
            <div className="h-14 w-14 rounded bg-rv-800 text-white flex items-center justify-center text-xl font-black">
              RV
            </div>
          )}
          <div>
            <div className="text-lg font-black text-rv-900 leading-tight">{empresa.nome}</div>
            <div className="text-[10px] text-slate-600 leading-tight">
              {empresa.responsavel_titulo} {empresa.responsavel} — {empresa.crea}
            </div>
            <div className="text-[10px] text-slate-600 leading-tight">
              {empresa.telefone} · {empresa.email}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-rv-900 leading-tight">{titulo}</div>
          {subtitulo && <div className="text-[11px] text-slate-600">{subtitulo}</div>}
        </div>
      </header>

      {cabecalho && <div className="mb-3">{cabecalho}</div>}

      <main>{children}</main>

      {assinar && (
        <div className="mt-8 evitar-quebra text-center">
          <div className="mx-auto w-64 border-t border-slate-700 pt-1 text-[11px]">
            {empresa.responsavel}
            <div className="text-[10px] text-slate-600">
              {empresa.responsavel_titulo} — {empresa.crea}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-6 border-t border-slate-300 pt-1 text-center text-[9px] text-slate-500">
        {empresa.nome} — {empresa.endereco} — {empresa.telefone} — {empresa.email} —{' '}
        {empresa.instagram}
        {geradoEm && <div>Documento gerado em {formatarDataHora(geradoEm)}</div>}
      </footer>
    </div>
  )
}

/** Bloco de identificacao (cliente, obra, periodo) no topo do documento. */
export function BlocoDados({ itens }: { itens: { rotulo: string; valor: React.ReactNode }[] }) {
  return (
    <table className="tabela">
      <tbody>
        {linhasEmPares(itens).map((par, i) => (
          <tr key={i}>
            {par.map((item) => (
              <Fragment key={item.rotulo}>
                <td className="bg-rv-50 font-semibold w-[110px]">{item.rotulo}</td>
                <td>{item.valor}</td>
              </Fragment>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function linhasEmPares<T>(itens: T[]): T[][] {
  const linhas: T[][] = []
  for (let i = 0; i < itens.length; i += 2) linhas.push(itens.slice(i, i + 2))
  return linhas
}

/** Barra de acoes que nao sai na impressao. */
export function BarraImpressao({ children }: { children?: React.ReactNode }) {
  return (
    <div className="nao-imprimir sticky top-0 z-10 bg-rv-900 text-white px-3 py-2 flex flex-wrap items-center gap-2">
      {children}
      <span className="text-[11px] text-rv-100 ml-auto">
        Use Imprimir → Salvar como PDF para enviar por WhatsApp.
      </span>
    </div>
  )
}
