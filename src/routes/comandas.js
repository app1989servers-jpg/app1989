const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../config/supabase')
const { autenticar, exigirPerfil } = require('../middleware/auth')

// GET /comandas?unidade_id=xxx&data=2025-05-15&status=aberta
router.get('/', autenticar, exigirPerfil('proprietario','gerente','colaborador','caixa'), async (req, res) => {
  try {
    const { unidade_id, data, status } = req.query
    const u = req.usuario

    let query = supabaseAdmin
      .from('comandas')
      .select(`
        id, status, subtotal, desconto, total, forma_pgto, aberta_em, finalizada_em, observacao,
        clientes(nome, whatsapp),
        colaboradores(nome)
      `)
      .order('aberta_em', { ascending: false })

    if (status)     query = query.eq('status', status)
    if (unidade_id) query = query.eq('unidade_id', unidade_id)
    else if (u.perfil !== 'proprietario') query = query.eq('unidade_id', u.unidade_id)

    if (data) {
      const ini = new Date(data + 'T00:00:00').toISOString()
      const fim = new Date(data + 'T23:59:59').toISOString()
      query = query.gte('aberta_em', ini).lte('aberta_em', fim)
    }

    if (u.perfil === 'colaborador') query = query.eq('colaborador_id', u.id)

    const { data: rows, error } = await query
    if (error) throw error
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar comandas' })
  }
})

// GET /comandas/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('comandas')
      .select(`
        *, 
        clientes(id, nome, whatsapp),
        colaboradores(id, nome),
        unidades(id, nome),
        itens_comanda(*)
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ erro: 'Comanda não encontrada' })
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar comanda' })
  }
})

// POST /comandas — abrir nova comanda
router.post('/', autenticar, exigirPerfil('proprietario','gerente','colaborador','caixa'), async (req, res) => {
  try {
    const { agendamento_id, cliente_id, colaborador_id, unidade_id, observacao } = req.body

    const { data, error } = await supabaseAdmin
      .from('comandas')
      .insert({
        agendamento_id: agendamento_id || null,
        cliente_id:     cliente_id || null,
        colaborador_id: colaborador_id || req.usuario.id,
        unidade_id:     unidade_id || req.usuario.unidade_id,
        observacao:     observacao || null,
        criado_por:     req.usuario.id
      })
      .select()
      .single()

    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao abrir comanda' })
  }
})

// POST /comandas/:id/itens — adicionar serviço ou produto
router.post('/:id/itens', autenticar, async (req, res) => {
  try {
    const { tipo, servico_id, produto_id, quantidade = 1 } = req.body
    const comanda_id = req.params.id

    let descricao, valor_unit

    if (tipo === 'servico' && servico_id) {
      const { data: s } = await supabaseAdmin.from('servicos').select('nome, valor').eq('id', servico_id).single()
      if (!s) return res.status(404).json({ erro: 'Serviço não encontrado' })
      descricao  = s.nome
      valor_unit = s.valor
    } else if (tipo === 'produto' && produto_id) {
      const { data: p } = await supabaseAdmin.from('produtos').select('nome, valor_venda').eq('id', produto_id).single()
      if (!p) return res.status(404).json({ erro: 'Produto não encontrado' })
      descricao  = p.nome
      valor_unit = p.valor_venda
    } else {
      return res.status(400).json({ erro: 'tipo inválido ou id ausente' })
    }

    const { data, error } = await supabaseAdmin
      .from('itens_comanda')
      .insert({ comanda_id, tipo, servico_id: servico_id || null, produto_id: produto_id || null, descricao, quantidade, valor_unit })
      .select()
      .single()

    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao adicionar item' })
  }
})

// DELETE /comandas/:id/itens/:item_id
router.delete('/:id/itens/:item_id', autenticar, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('itens_comanda').delete()
      .eq('id', req.params.item_id).eq('comanda_id', req.params.id)
    if (error) throw error
    return res.json({ mensagem: 'Item removido' })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao remover item' })
  }
})

// PUT /comandas/:id/finalizar
router.put('/:id/finalizar', autenticar, async (req, res) => {
  try {
    const { forma_pgto, desconto = 0 } = req.body
    const { id } = req.params

    if (!forma_pgto) return res.status(400).json({ erro: 'forma_pgto é obrigatório' })

    // Recalcula total com desconto
    const { data: itens } = await supabaseAdmin
      .from('itens_comanda').select('valor_total').eq('comanda_id', id)

    const subtotal = (itens || []).reduce((s, i) => s + parseFloat(i.valor_total), 0)
    const total    = Math.max(0, subtotal - parseFloat(desconto))

    const { data, error } = await supabaseAdmin
      .from('comandas')
      .update({ status: 'finalizada', forma_pgto, desconto, subtotal, total, finalizada_em: new Date().toISOString() })
      .eq('id', id).select().single()

    if (error) throw error

    // Registra saída de estoque para produtos
    const { data: prodItens } = await supabaseAdmin
      .from('itens_comanda').select('produto_id, quantidade').eq('comanda_id', id).eq('tipo', 'produto').not('produto_id', 'is', null)

    for (const item of (prodItens || [])) {
      await supabaseAdmin.from('movimentacoes_estoque').insert({
        produto_id:     item.produto_id,
        unidade_id:     data.unidade_id,
        tipo:           'saida_venda',
        quantidade:     item.quantidade,
        responsavel_id: data.colaborador_id,
        referencia_id:  id
      })
    }

    return res.json(data)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao finalizar comanda' })
  }
})

module.exports = router
