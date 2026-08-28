'use client'

/**
 * Envio da proposta ao cliente pelo WhatsApp — que e por onde ela vai, na
 * pratica. Abre a conversa ja com o texto pronto; o PDF a pessoa anexa depois
 * de salvar pela impressao, porque o WhatsApp nao aceita arquivo por link.
 */
export function EnviarWhatsApp({
  telefone,
  nomeCliente,
  potencia,
  economiaMes,
  investimento,
  empresa,
}: {
  telefone: string | null
  nomeCliente: string
  potencia: string
  economiaMes: string
  investimento: string
  empresa: string
}) {
  const texto = [
    `Olá, ${nomeCliente}! Aqui é da ${empresa}.`,
    '',
    `Preparei a proposta do seu sistema de energia solar:`,
    `• Sistema de ${potencia}`,
    `• Economia estimada de ${economiaMes} por mês`,
    `• Investimento de ${investimento}`,
    '',
    'Segue a proposta completa em anexo. Qualquer dúvida, estou à disposição.',
  ].join('\n')

  const numero = (telefone ?? '').replace(/\D/g, '')
  // numero brasileiro sem o 55 na frente ganha o codigo do pais
  const destino = numero.length >= 10 && !numero.startsWith('55') ? `55${numero}` : numero
  const url = destino
    ? `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`

  return (
    <a href={url} target="_blank" rel="noreferrer" className="botao botao-primario">
      {destino ? 'Enviar ao cliente pelo WhatsApp' : 'Enviar pelo WhatsApp'}
    </a>
  )
}
