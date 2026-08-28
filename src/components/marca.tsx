/**
 * A marca da empresa na interface: a logo configurada em Cadastros →
 * Parametros (`empresa_logo_url`) ou, enquanto ela nao existir, o monograma.
 *
 * A logo sempre entra sobre um fundo branco. A barra do topo e o fundo da
 * tela de login sao azul-escuro, e uma logo de traco escuro sumiria ali —
 * o fundo branco garante o contraste seja qual for o arquivo enviado.
 *
 * Nao usa next/image de proposito: o endereco da logo depende do projeto
 * Supabase de cada instalacao, e isso exigiria configurar o dominio no
 * next.config a cada instalacao.
 */
export function Marca({
  logoUrl,
  nome,
  tamanho = 'barra',
}: {
  logoUrl: string
  nome: string
  tamanho?: 'barra' | 'entrada'
}) {
  const naBarra = tamanho === 'barra'
  const caixa = naBarra
    ? 'h-9 rounded-md px-1.5 shadow-sm'
    : 'h-16 rounded-xl px-2.5'

  if (logoUrl) {
    return (
      <span className={`inline-flex items-center justify-center bg-white ${caixa}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={nome}
          className={`w-auto object-contain ${naBarra ? 'max-h-7 max-w-[7.5rem]' : 'max-h-12 max-w-[11rem]'}`}
        />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center bg-white text-rv-900 font-black tracking-tight ${
        naBarra ? 'h-9 w-9 rounded-md text-base shadow-sm' : 'h-16 w-16 rounded-xl text-2xl'
      }`}
    >
      RV
    </span>
  )
}
