const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../config/supabase')
const { autenticar, exigirPerfil } = require('../middleware/auth')

const SEM_ACESSO = exigirPerfil('proprietario', 'gerente')

// GET /financeiro/resumo?unidade_id=xxx&periodo=mes
router.get('/resumo', autenticar, SEM_ACESSO, async (req, res) => {
  try {
    const { unidade_id, periodo = 'mes' } = req.query
    const u = req.usuario

    const { ini, fim } = getPeriodo(periodo)
    const uid = u.perfil === 'proprietario' ? unidade_id : u.unidade_id

    let query = supabaseAdmin
      .from('comandas')
      .select('total, forma_pgto, colaborador_id')
      .eq('status', 'finalizada')
      .gte('finalizada_em', ini).lte('finalizada_em', fim)

    if (uid) query = query.eq('unidade_id', uid)

    const { data: comandas, error } = await query
    if (error) throw error

    const faturamento   = somar(comandas, 'total')
    const total_credito = somar(comandas.filter(c => c.forma_pgto === 'credito'), 'total')
    const total_debito  = somar(comandas.filter(c => c.forma_pgto === 'debito'),  'total')
    const total_pix     = somar(comandas.filter(c => c.forma_pgto === 'pix'),     'total')
    const total_dinheiro= somar(comandas.filter(c => c.forma_pgto === 'dinheiro'),'total')

    // Busca comissões
    const { data: colabs } = await supabaseAdmin
      .from('colaboradores').select('id, comissao_pct')
    const comissoes = (comandas || []).reduce((acc, c) => {
      const col = (colabs || []).find(x => x.id === c.colaborador_id)
      return acc + (col ? parseFloat(c.total) * col.comissao_pct / 100 : 0)
    }, 0)

    return res.json({
      periodo,
      faturamento:    round(faturamento),
      comissoes:      round(comissoes),
      liquido:        round(faturamento - comissoes),
      total_comandas: comandas.length,
      ticket_medio:   comandas.length ? round(faturamento / comandas.length) : 0,
      formas: {
        credito:  round(total_credito),
        debito:   round(total_debito),
        pix:      round(total_pix),
        dinheiro: round(total_dinheiro)
      }
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao buscar resumo financeiro' })
  }
})

// GET /financeiro/comissoes?periodo=mes
router.get('/comissoes', autenticar, SEM_ACESSO, async (req, res) => {
  try {
    const { periodo = 'mes', unidade_id } = req.query
    const u = req.usuario
    const { ini, fim } = getPeriodo(periodo)
    const uid = u.perfil === 'proprietario' ? unidade_id : u.unidade_id

    const { data, error } = await supabaseAdmin
      .from('vw_comissoes_mes')
      .select('*')
      .gte('mes', ini).lte('mes', fim)

    if (uid) {
      const filtered = (data || []).filter(r => r.unidade_nome !== undefined)
      return res.json(filtered)
    }
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar comissões' })
  }
})

// GET /financeiro/comissao-propria?periodo=mes — barbeiro vê a própria
router.get('/comissao-propria', autenticar, exigirPerfil('colaborador', 'gerente'), async (req, res) => {
  try {
    const { periodo = 'mes' } = req.query
    const { ini, fim } = getPeriodo(periodo)

    const { data: col } = await supabaseAdmin
      .from('colaboradores').select('comissao_pct').eq('id', req.usuario.id).single()
    if (!col) return res.status(404).json({ erro: 'Colaborador não encontrado' })

    const { data: comandas } = await supabaseAdmin
      .from('comandas').select('total')
      .eq('colaborador_id', req.usuario.id)
      .eq('status', 'finalizada')
      .gte('finalizada_em', ini).lte('finalizada_em', fim)

    const faturado  = somar(comandas || [], 'total')
    const comissao  = round(faturado * col.comissao_pct / 100)

    return res.json({
      periodo,
      total_comandas: (comandas || []).length,
      faturado:       round(faturado),
      comissao_pct:   col.comissao_pct,
      comissao
    })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar comissão' })
  }
})

// GET /relatorios/servicos?periodo=mes
router.get('/relatorios/servicos', autenticar, SEM_ACESSO, async (req, res) => {
  try {
    const { periodo = 'mes', unidade_id } = req.query
    const { ini, fim } = getPeriodo(periodo)

    const { data, error } = await supabaseAdmin
      .from('itens_comanda')
      .select('descricao, quantidade, valor_total, servico_id, comandas(unidade_id, finalizada_em, status)')
      .eq('tipo', 'servico')
      .not('servico_id', 'is', null)

    if (error) throw error

    const filtrado = (data || []).filter(i =>
      i.comandas?.status === 'finalizada' &&
      i.comandas?.finalizada_em >= ini &&
      i.comandas?.finalizada_em <= fim &&
      (!unidade_id || i.comandas?.unidade_id === unidade_id)
    )

    // Agrupa por serviço
    const mapa = {}
    filtrado.forEach(i => {
      if (!mapa[i.descricao]) mapa[i.descricao] = { nome: i.descricao, quantidade: 0, faturado: 0 }
      mapa[i.descricao].quantidade += i.quantidade
      mapa[i.descricao].faturado   += parseFloat(i.valor_total)
    })

    const ranking = Object.values(mapa)
      .map(r => ({ ...r, faturado: round(r.faturado) }))
      .sort((a, b) => b.faturado - a.faturado)

    return res.json(ranking)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar relatório de serviços' })
  }
})

// GET /relatorios/retencao
router.get('/relatorios/retencao', autenticar, SEM_ACESSO, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vw_clientes_reativar').select('*')
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar retenção' })
  }
})

// GET /relatorios/estoque-alertas
router.get('/relatorios/estoque', autenticar, exigirPerfil('proprietario','gerente','caixa'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vw_estoque_alertas').select('*')
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar estoque' })
  }
})

// Helpers
function getPeriodo(periodo) {
  const agora = new Date()
  let ini, fim

  if (periodo === 'hoje') {
    ini = new Date(agora.setHours(0,0,0,0)).toISOString()
    fim = new Date(agora.setHours(23,59,59,999)).toISOString()
  } else if (periodo === 'semana') {
    const dom = new Date(agora)
    dom.setDate(agora.getDate() - agora.getDay())
    dom.setHours(0,0,0,0)
    ini = dom.toISOString()
    fim = new Date().toISOString()
  } else if (periodo === 'mes') {
    ini = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
    fim = new Date().toISOString()
  } else if (periodo === 'trim') {
    const m = Math.floor(agora.getMonth() / 3) * 3
    ini = new Date(agora.getFullYear(), m, 1).toISOString()
    fim = new Date().toISOString()
  } else if (periodo === 'ano') {
    ini = new Date(agora.getFullYear(), 0, 1).toISOString()
    fim = new Date().toISOString()
  } else {
    ini = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
    fim = new Date().toISOString()
  }
  return { ini, fim }
}

function somar(arr, campo) {
  return (arr || []).reduce((s, r) => s + parseFloat(r[campo] || 0), 0)
}

function round(n) {
  return Math.round(n * 100) / 100
}

module.exports = router
