import { redirect } from 'next/navigation'

export default function Inicio() {
  // A navegacao comeca sempre pelo modulo de obras: e o que resolve o dia a dia.
  redirect('/obras')
}
