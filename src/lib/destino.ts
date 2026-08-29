/**
 * Destino interno seguro para depois do link de e-mail.
 *
 * O endereco de retorno chega pela URL, e a URL vem do e-mail — quer dizer,
 * de fora. Sem esta trava, `?proximo=https://site-falso` faria um link com o
 * dominio da RV levar a pessoa para outro lugar, no momento em que ela esta
 * justamente digitando uma senha.
 *
 * So passa caminho do proprio app: comeca com uma barra e nao com duas
 * (`//site-falso` e endereco absoluto para o navegador, apesar da barra).
 */
export function destinoSeguro(pedido: string | null, padrao: string): string {
  if (!pedido) return padrao
  if (!pedido.startsWith('/')) return padrao
  if (pedido.startsWith('//')) return padrao
  // `/\site-falso` tambem escapa em alguns navegadores.
  if (pedido.startsWith('/\\')) return padrao
  return pedido
}
