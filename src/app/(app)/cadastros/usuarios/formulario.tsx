'use client'

import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { criarUsuario, vincularObra } from './acoes'

export function FormularioUsuario() {
  return (
    <FormularioAcao acao={criarUsuario} className="space-y-2" rotuloBotao="Criar usuário">
      <Campo rotulo="Nome" nome="nome" obrigatorio />
      <Campo rotulo="E-mail" nome="email" tipo="email" obrigatorio />
      <Campo
        rotulo="Senha provisória"
        nome="senha"
        tipo="password"
        obrigatorio
        dica="Mínimo de 8 caracteres"
      />
      <Selecao
        rotulo="Perfil"
        nome="perfil"
        valor="lancador"
        opcoes={[
          { valor: 'lancador', rotulo: 'Lançador (encarregado)' },
          { valor: 'admin', rotulo: 'Administrador (engenheiro)' },
        ]}
        dica="O lançador só lança presença, quentinha e foto de nota das obras vinculadas."
      />
    </FormularioAcao>
  )
}

export function FormularioVinculo({
  usuarios,
  obras,
}: {
  usuarios: { id: string; nome: string }[]
  obras: { id: string; nome: string }[]
}) {
  return (
    <FormularioAcao acao={vincularObra} className="space-y-2" rotuloBotao="Vincular">
      <Selecao
        rotulo="Lançador"
        nome="usuario_id"
        vazio="— selecione —"
        opcoes={usuarios.map((u) => ({ valor: u.id, rotulo: u.nome }))}
        obrigatorio
      />
      <Selecao
        rotulo="Obra"
        nome="obra_id"
        vazio="— selecione —"
        opcoes={obras.map((o) => ({ valor: o.id, rotulo: o.nome }))}
        obrigatorio
      />
    </FormularioAcao>
  )
}
