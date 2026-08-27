/**
 * O app so funciona com o Supabase configurado. Sem as variaveis de ambiente
 * a navegacao vai para /configurar, com o passo a passo — e melhor do que uma
 * tela de erro na primeira vez que alguem abre o app recem-publicado.
 */
export function supabaseConfigurado(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !chave) return false
  if (url.includes('exemplo.supabase.co') || url.includes('xxxxxxxx')) return false
  try {
    new URL(url)
  } catch {
    return false
  }
  return true
}
