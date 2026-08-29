'use client'

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { criarClienteBrowser } from '@/lib/supabase/client'

export interface FotoEnviada {
  caminho: string
  previa: string
  nome: string
  pdf: boolean
}

/**
 * Anexo de comprovante e de nota, por dois caminhos.
 *
 * O botao da camera abre a camera; o de arquivo abre a galeria do celular ou a
 * pasta do computador, e aceita PDF. Antes havia um botao so, com
 * `capture="environment"`, e esse atributo faz o celular abrir a camera DIRETO,
 * sem oferecer a galeria — quem estava viajando, com a nota guardada no
 * carretel, nao tinha como anexar. Os dois caminhos existem porque os dois
 * acontecem: a nota fotografada na hora, na obra, e a que chega depois por
 * WhatsApp ou e-mail.
 *
 * A imagem e comprimida no aparelho antes de subir (spec 2). PDF sobe como
 * esta: comprimir PDF no navegador estragaria o documento.
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
  const entradaCamera = useRef<HTMLInputElement>(null)
  const entradaArquivo = useRef<HTMLInputElement>(null)

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
          pdf: arquivo.type === 'application/pdf',
        })
      }

      const todas = [...fotos, ...novas]
      setFotos(todas)
      aoMudar?.(todas)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.')
    } finally {
      setEnviando(false)
      // Limpa as duas: sem isso, escolher o mesmo arquivo de novo nao dispara
      // o onChange e parece que o botao quebrou.
      if (entradaCamera.current) entradaCamera.current.value = ''
      if (entradaArquivo.current) entradaArquivo.current.value = ''
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
            {f.pdf ? (
              // PDF nao aparece dentro de <img>: mostraria um quadro quebrado.
              <div className="h-24 w-24 rounded border border-slate-300 bg-rv-50 flex flex-col items-center justify-center gap-1 px-1">
                <span className="text-rv-800 font-bold text-[11px]">PDF</span>
                <span className="text-[9px] text-slate-600 text-center leading-tight break-all line-clamp-3">
                  {f.nome}
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.previa}
                alt={f.nome}
                className="h-24 w-24 object-cover rounded border border-slate-300"
              />
            )}
            <button
              type="button"
              onClick={() => remover(f.caminho)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-erro-700 text-white text-xs font-bold"
              aria-label={`Remover ${f.nome}`}
            >
              ×
            </button>
          </figure>
        ))}
      </div>

      {/* Camera: `capture` so aqui. */}
      <input
        ref={entradaCamera}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => enviar(e.target.files)}
      />
      {/* Galeria e arquivo: sem `capture`, senao o celular pula a galeria. */}
      <input
        ref={entradaArquivo}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => enviar(e.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="botao botao-primario"
          disabled={enviando}
          onClick={() => entradaCamera.current?.click()}
        >
          {enviando ? 'Enviando…' : rotulo}
        </button>
        <button
          type="button"
          className="botao botao-neutro"
          disabled={enviando}
          onClick={() => entradaArquivo.current?.click()}
        >
          {enviando ? 'Enviando…' : 'Escolher da galeria ou arquivo'}
        </button>
        {fotos.length > 0 && (
          <span className="self-center text-xs text-ok-700 font-medium">
            {fotos.length} anexo(s)
          </span>
        )}
      </div>

      {erro && <p className="mt-2 text-sm text-erro-700">{erro}</p>}
      <p className="mt-1 text-[11px] text-slate-500">
        Use a câmera quando estiver com o papel na mão. Use “escolher” para a foto que já está
        no celular, para um PDF ou para um arquivo do computador. A imagem é comprimida antes de
        subir; PDF sobe como está. Cupom longo: pode anexar mais de um.
      </p>
    </div>
  )
}
