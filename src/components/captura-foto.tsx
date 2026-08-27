'use client'

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { criarClienteBrowser } from '@/lib/supabase/client'

export interface FotoEnviada {
  caminho: string
  previa: string
  nome: string
}

/**
 * Captura direta pela camera do celular, com compressao antes do upload
 * (spec 2). Permite mais de uma foto por nota, para cupom longo.
 *
 * O caminho segue a convencao <obra_id>/<pasta>/<arquivo>, que e o que as
 * policies do Storage usam para decidir o acesso por obra.
 */
export function CapturaFoto({
  bucket,
  obraId,
  pasta,
  nomeCampo = 'foto',
  rotulo = 'Fotografar nota',
  aoMudar,
}: {
  bucket: string
  obraId: string
  pasta: string
  nomeCampo?: string
  rotulo?: string
  aoMudar?: (fotos: FotoEnviada[]) => void
}) {
  const [fotos, setFotos] = useState<FotoEnviada[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  async function enviar(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return
    setErro(null)
    setEnviando(true)
    const supabase = criarClienteBrowser()
    const novas: FotoEnviada[] = []

    try {
      for (const arquivo of Array.from(arquivos)) {
        const comprimido =
          arquivo.type === 'application/pdf'
            ? arquivo
            : await imageCompression(arquivo, {
                maxSizeMB: 1,
                maxWidthOrHeight: 2000,
                useWebWorker: true,
                fileType: 'image/jpeg',
                initialQuality: 0.75,
              })

        const extensao = arquivo.type === 'application/pdf' ? 'pdf' : 'jpg'
        const caminho = `${obraId}/${pasta}/${crypto.randomUUID()}.${extensao}`

        const { error } = await supabase.storage.from(bucket).upload(caminho, comprimido, {
          contentType: comprimido.type || 'image/jpeg',
          upsert: false,
        })
        if (error) throw error

        novas.push({
          caminho,
          previa: URL.createObjectURL(comprimido),
          nome: arquivo.name,
        })
      }

      const todas = [...fotos, ...novas]
      setFotos(todas)
      aoMudar?.(todas)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.')
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  function remover(caminho: string) {
    const todas = fotos.filter((f) => f.caminho !== caminho)
    setFotos(todas)
    aoMudar?.(todas)
    // O arquivo fica no Storage: nada e apagado sem passar pelo administrador.
  }

  return (
    <div>
      {fotos.map((f) => (
        <input key={f.caminho} type="hidden" name={nomeCampo} value={f.caminho} />
      ))}

      <div className="flex flex-wrap gap-2 mb-2">
        {fotos.map((f) => (
          <figure key={f.caminho} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.previa}
              alt={f.nome}
              className="h-24 w-24 object-cover rounded border border-slate-300"
            />
            <button
              type="button"
              onClick={() => remover(f.caminho)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-erro-700 text-white text-xs font-bold"
              aria-label="Remover foto"
            >
              ×
            </button>
          </figure>
        ))}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => enviar(e.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="botao botao-primario"
          disabled={enviando}
          onClick={() => entrada.current?.click()}
        >
          {enviando ? 'Enviando…' : fotos.length > 0 ? 'Adicionar outra foto' : rotulo}
        </button>
        {fotos.length > 0 && (
          <span className="self-center text-xs text-ok-700 font-medium">
            {fotos.length} foto(s) anexada(s)
          </span>
        )}
      </div>

      {erro && <p className="mt-2 text-sm text-erro-700">{erro}</p>}
      <p className="mt-1 text-[11px] text-slate-500">
        A imagem é comprimida no celular antes de subir. Cupom longo: tire mais de uma foto.
      </p>
    </div>
  )
}
