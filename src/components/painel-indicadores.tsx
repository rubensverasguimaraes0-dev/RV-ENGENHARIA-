/**
 * Painel de indicadores: os quatro numeros que respondem "como esta a obra"
 * antes de a pessoa ler a tabela.
 *
 * Fica num componente porque aparece em dois lugares que precisam contar a
 * mesma historia: a tela de pagamentos e o cronograma que vai para o cliente.
 * Duas copias divergiriam na primeira mudanca.
 */
export function PainelIndicadores({
  itens,
}: {
  itens: { rotulo: string; valor: string; tom?: 'pago' | 'saldo' }[]
}) {
  return (
    <div className="painel">
      {itens.map((i) => (
        <div key={i.rotulo} className={`indicador ${i.tom ? `indicador-${i.tom}` : ''}`}>
          <div className="indicador-rotulo">{i.rotulo}</div>
          <div className="indicador-valor">{i.valor}</div>
        </div>
      ))}
    </div>
  )
}
