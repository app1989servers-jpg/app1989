const express = require('express')
const router  = express.Router()
const { supabaseAdmin } = require('../config/supabase')
const { autenticar, exigirPerfil } = require('../middleware/auth')

const ADMIN  = exigirPerfil('proprietario', 'gerente')
const TODOS  = exigirPerfil('proprietario', 'gerente', 'colaborador', 'caixa')

// ============================================================
// #7 PROGRAMA FIDELIDADE — pontos
// ============================================================

// GET /fidelidade/:cliente_id — saldo de pontos do cliente
router.get('/fidelidade/:cliente_id', autenticar, TODOS, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('carteira_pontos')
      .select('*, historico_pontos(tipo, pontos, descricao, criado_em)')
      .eq('cliente_id', req.params.cliente_id)
      .single()
    if (error && error.code === 'PGRST116') {
      // Carteira não existe ainda — cria zerada
      const { data: nova } = await supabaseAdmin
        .from('carteira_pontos').insert({ cliente_id: req.params.cliente_id }).select().single()
      return res.json(nova)
    }
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar pontos' })
  }
})

// POST /fidelidade/creditar — credita pontos ao fechar comanda
router.post('/fidelidade/creditar', autenticar, TODOS, async (req, res) => {
  try {
    const { cliente_id, valor_comanda, comanda_id } = req.body
    if (!cliente_id || !valor_comanda) return res.status(400).json({ erro: 'Campos obrigatórios ausentes' })
    const pontos = Math.floor(parseFloat(valor_comanda)) // 1 real = 1 ponto

    // Upsert carteira
    await supabaseAdmin.from('carteira_pontos').upsert({
      cliente_id,
      saldo: pontos,
      total_acumulado: pontos
    }, { onConflict: 'cliente_id', ignoreDuplicates: false })

    // Incrementa saldo
    await supabaseAdmin.rpc('incrementar_pontos', { p_cliente_id: cliente_id, p_pontos: pontos })

    // Histórico
    await supabaseAdmin.from('historico_pontos').insert({
      cliente_id, tipo: 'credito', pontos,
      descricao: `Comanda finalizada — R$ ${valor_comanda}`,
      referencia_id: comanda_id || null
    })

    return res.json({ pontos_creditados: pontos })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao creditar pontos' })
  }
})

// POST /fidelidade/zerar-noshow — zera pontos por no-show
router.post('/fidelidade/zerar-noshow', autenticar, TODOS, async (req, res) => {
  try {
    const { cliente_id, agendamento_id } = req.body

    const { data: carteira } = await supabaseAdmin
      .from('carteira_pontos').select('saldo').eq('cliente_id', cliente_id).single()
    if (!carteira || carteira.saldo === 0) return res.json({ mensagem: 'Saldo já era zero' })

    await supabaseAdmin.from('carteira_pontos')
      .update({ saldo: 0 }).eq('cliente_id', cliente_id)

    await supabaseAdmin.from('historico_pontos').insert({
      cliente_id, tipo: 'zeragem_noshow', pontos: -carteira.saldo,
      descricao: 'Pontos zerados por no-show sem cancelamento prévio',
      referencia_id: agendamento_id || null
    })

    return res.json({ pontos_zerados: carteira.saldo })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao zerar pontos' })
  }
})

// POST /fidelidade/resgatar — resgata pontos em produto (máx 5 por resgate)
router.post('/fidelidade/resgatar', autenticar, TODOS, async (req, res) => {
  try {
    const { cliente_id, pontos, comanda_id } = req.body
    const LIMITE_POR_RESGATE = 5

    if (pontos > LIMITE_POR_RESGATE) {
      return res.status(400).json({ erro: `Limite de ${LIMITE_POR_RESGATE} pontos por resgate` })
    }

    const { data: carteira } = await supabaseAdmin
      .from('carteira_pontos').select('saldo').eq('cliente_id', cliente_id).single()

    if (!carteira || carteira.saldo < pontos) {
      return res.status(400).json({ erro: 'Saldo insuficiente' })
    }

    await supabaseAdmin.from('carteira_pontos')
      .update({ saldo: carteira.saldo - pontos }).eq('cliente_id', cliente_id)

    await supabaseAdmin.from('historico_pontos').insert({
      cliente_id, tipo: 'debito', pontos: -pontos,
      descricao: `Resgate em produto — R$ ${pontos},00 de desconto`,
      referencia_id: comanda_id || null
    })

    return res.json({ desconto_aplicado: pontos, saldo_restante: carteira.saldo - pontos })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao resgatar pontos' })
  }
})

// ============================================================
// #10 LISTA DE ESPERA
// ============================================================

router.get('/espera', autenticar, TODOS, async (req, res) => {
  try {
    const { unidade_id, data } = req.query
    let query = supabaseAdmin
      .from('lista_espera')
      .select('*, clientes(nome, whatsapp), servicos(nome), espera_colaboradores(colaboradores(nome))')
      .eq('status', 'aguardando')
      .order('criado_em')
    if (unidade_id) query = query.eq('unidade_id', unidade_id)
    if (data)       query = query.eq('data_desejada', data)
    const { data: rows, error } = await query
    if (error) throw error
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar lista de espera' })
  }
})

router.post('/espera', autenticar, async (req, res) => {
  try {
    const { cliente_id, unidade_id, servico_id, data_desejada, hora_ini, hora_fim, observacao, colaborador_ids } = req.body
    const { data, error } = await supabaseAdmin
      .from('lista_espera')
      .insert({ cliente_id, unidade_id, servico_id, data_desejada, hora_ini, hora_fim, observacao })
      .select().single()
    if (error) throw error

    if (colaborador_ids?.length) {
      const rows = colaborador_ids.map(id => ({ espera_id: data.id, colaborador_id: id }))
      await supabaseAdmin.from('espera_colaboradores').insert(rows)
    }

    // Notifica barbeiros e caixa da unidade via WhatsApp
    const { data: colabs } = await supabaseAdmin
      .from('colaboradores').select('whatsapp, nome').eq('unidade_id', unidade_id).eq('ativo', true)
    const { data: cliente } = await supabaseAdmin.from('clientes').select('nome').eq('id', cliente_id).single()

    for (const col of (colabs || [])) {
      if (!col.whatsapp) continue
      await supabaseAdmin.from('notificacoes_whatsapp').insert({
        destinatario: '55' + col.whatsapp.replace(/\D/g, ''),
        mensagem: `🔔 Nova entrada na lista de espera!\n\nCliente: *${cliente?.nome}*\nData: ${data_desejada}\nHorário: ${hora_ini || 'Flexível'}${hora_fim ? ' às ' + hora_fim : ''}\nServiço: ${servico_id ? 'ver no sistema' : 'a definir'}`,
        tipo: 'lista_espera',
        referencia_id: data.id,
        status: 'pendente'
      })
    }

    return res.status(201).json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao entrar na lista de espera' })
  }
})

// PUT /espera/:id/alocar — aloca um horário para o cliente em espera
router.put('/espera/:id/alocar', autenticar, TODOS, async (req, res) => {
  try {
    const { data_hora_ini, colaborador_id } = req.body
    const { data: espera } = await supabaseAdmin
      .from('lista_espera').select('*, clientes(nome, whatsapp), servicos(duracao_min, valor, nome)').eq('id', req.params.id).single()
    if (!espera) return res.status(404).json({ erro: 'Entrada não encontrada' })

    // Cria agendamento
    const ini = new Date(data_hora_ini)
    const fim = new Date(ini.getTime() + (espera.servicos?.duracao_min || 30) * 60000)
    await supabaseAdmin.from('agendamentos').insert({
      unidade_id: espera.unidade_id, colaborador_id,
      cliente_id: espera.cliente_id, servico_id: espera.servico_id,
      data_hora_ini: ini.toISOString(), data_hora_fim: fim.toISOString(),
      valor: espera.servicos?.valor || 0, canal_origem: 'lista_espera'
    })

    // Atualiza status
    await supabaseAdmin.from('lista_espera').update({ status: 'notificado' }).eq('id', req.params.id)

    // Notifica cliente
    if (espera.clientes?.whatsapp) {
      const hora = ini.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const data = ini.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
      await supabaseAdmin.from('notificacoes_whatsapp').insert({
        destinatario: '55' + espera.clientes.whatsapp.replace(/\D/g, ''),
        mensagem: `✅ Temos um horário para você!\n\n✂️ *${espera.servicos?.nome || 'Serviço'}*\n🕐 ${hora} — ${data}\n\nDeseja confirmar? Responda *SIM* para confirmar ou *NÃO* para recusar.`,
        tipo: 'lista_espera_notif',
        referencia_id: req.params.id,
        status: 'pendente'
      })
    }

    return res.json({ mensagem: 'Cliente notificado com sucesso' })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao alocar horário' })
  }
})

// ============================================================
// #14 CONVÊNIOS
// ============================================================

router.get('/convenios', autenticar, TODOS, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('convenios').select('*').eq('ativo', true).order('nome_empresa')
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar convênios' })
  }
})

router.post('/convenios', autenticar, exigirPerfil('proprietario'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('convenios').insert(req.body).select().single()
    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar convênio' })
  }
})

// POST /convenios/vincular-cliente — vincula cliente a convênio
router.post('/convenios/vincular-cliente', autenticar, TODOS, async (req, res) => {
  try {
    const { cliente_id, convenio_id } = req.body
    const { data, error } = await supabaseAdmin
      .from('clientes').update({ convenio_id }).eq('id', cliente_id).select().single()
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao vincular convênio' })
  }
})

// ============================================================
// #11 VALES DE FUNCIONÁRIOS
// ============================================================

router.get('/vales', autenticar, ADMIN, async (req, res) => {
  try {
    const { unidade_id, colaborador_id } = req.query
    let query = supabaseAdmin
      .from('vales_funcionarios')
      .select('*, colaboradores(nome), itens_vale(*)')
      .order('aberto_em', { ascending: false })
    if (unidade_id)    query = query.eq('unidade_id', unidade_id)
    if (colaborador_id)query = query.eq('colaborador_id', colaborador_id)
    const { data, error } = await query
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar vales' })
  }
})

router.post('/vales', autenticar, TODOS, async (req, res) => {
  try {
    const { colaborador_id, unidade_id, tipo, itens } = req.body
    const total = (itens || []).reduce((s, i) => s + i.quantidade * i.valor_unit, 0)

    const { data: vale, error } = await supabaseAdmin
      .from('vales_funcionarios')
      .insert({ colaborador_id, unidade_id, tipo, total, status: 'aberto' })
      .select().single()
    if (error) throw error

    if (itens?.length) {
      const rows = itens.map(i => ({ ...i, vale_id: vale.id }))
      await supabaseAdmin.from('itens_vale').insert(rows)
    }
    return res.status(201).json(vale)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar vale' })
  }
})

// PUT /vales/:id/autorizar — gerente autoriza com senha
router.put('/vales/:id/autorizar', autenticar, ADMIN, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vales_funcionarios')
      .update({ status: 'autorizado', autorizado_por: req.usuario.id, autorizado_em: new Date().toISOString() })
      .eq('id', req.params.id).select().single()
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao autorizar vale' })
  }
})

// ============================================================
// #12 SAÍDAS DO CAIXA
// ============================================================

router.get('/saidas-caixa', autenticar, ADMIN, async (req, res) => {
  try {
    const { unidade_id, data } = req.query
    let query = supabaseAdmin
      .from('saidas_caixa')
      .select('*, colaboradores!responsavel_id(nome)')
      .order('criado_em', { ascending: false })
    if (unidade_id) query = query.eq('unidade_id', unidade_id)
    if (data) {
      query = query.gte('criado_em', data + 'T00:00:00').lte('criado_em', data + 'T23:59:59')
    }
    const { data: rows, error } = await query
    if (error) throw error
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar saídas' })
  }
})

router.post('/saidas-caixa', autenticar, TODOS, async (req, res) => {
  try {
    const { unidade_id, motivo, valor, descricao, responsavel_id } = req.body
    const { data, error } = await supabaseAdmin
      .from('saidas_caixa')
      .insert({ unidade_id, motivo, valor, descricao, responsavel_id, autorizado_por: req.usuario.id })
      .select().single()
    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao registrar saída' })
  }
})

// ============================================================
// #20 METAS DO BARBEIRO
// ============================================================

router.get('/metas/:colaborador_id', autenticar, async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7)
    const { data, error } = await supabaseAdmin
      .from('metas_colaborador').select('*')
      .eq('colaborador_id', req.params.colaborador_id).eq('mes', mes).single()
    if (error && error.code === 'PGRST116') return res.json(null)
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar metas' })
  }
})

router.post('/metas', autenticar, ADMIN, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('metas_colaborador')
      .upsert({ ...req.body, definida_por: req.usuario.id }, { onConflict: 'colaborador_id,mes' })
      .select().single()
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao salvar meta' })
  }
})

// ============================================================
// #9 NÍVEL DO BARBEIRO
// ============================================================

router.put('/colaboradores/:id/nivel', autenticar, ADMIN, async (req, res) => {
  try {
    const { nivel } = req.body
    const { data, error } = await supabaseAdmin
      .from('colaboradores').update({ nivel }).eq('id', req.params.id).select().single()
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar nível' })
  }
})

// GET /nivel-tempo/:nivel — retorna duração em minutos por nível
router.get('/nivel-tempo/:nivel', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('nivel_tempo_servico').select('duracao_min').eq('nivel', req.params.nivel).single()
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Nível não encontrado' })
  }
})

// ============================================================
// #4 COMISSÃO POR VENDA DE PLANO
// ============================================================

// POST /planos/comissao — registra comissão ao vender/renovar plano
router.post('/planos/comissao', autenticar, TODOS, async (req, res) => {
  try {
    const { assinatura_id, colaborador_id, valor_plano, pct_comissao } = req.body
    const valor_comissao = Math.round(valor_plano * pct_comissao / 100 * 100) / 100
    const mes = new Date().toISOString().slice(0, 7)

    const { data, error } = await supabaseAdmin
      .from('comissoes_planos')
      .insert({ assinatura_id, colaborador_id, valor_plano, pct_comissao, valor_comissao, mes })
      .select().single()
    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao registrar comissão de plano' })
  }
})

// GET /planos/comissoes?colaborador_id=xxx&mes=2025-05
router.get('/planos/comissoes', autenticar, ADMIN, async (req, res) => {
  try {
    const { colaborador_id, mes } = req.query
    let query = supabaseAdmin
      .from('comissoes_planos')
      .select('*, colaboradores(nome), assinaturas(planos(nome), clientes(nome))')
      .order('criado_em', { ascending: false })
    if (colaborador_id) query = query.eq('colaborador_id', colaborador_id)
    if (mes)            query = query.eq('mes', mes)
    const { data, error } = await query
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar comissões de planos' })
  }
})

// ============================================================
// #16 RENOVAÇÃO DE PLANO — alerta 10 dias antes
// ============================================================

// GET /assinaturas/vencendo — assinaturas que vencem em até 10 dias
router.get('/assinaturas/vencendo', autenticar, ADMIN, async (req, res) => {
  try {
    const hoje = new Date()
    const em10dias = new Date(hoje)
    em10dias.setDate(em10dias.getDate() + 10)

    const { data, error } = await supabaseAdmin
      .from('assinaturas')
      .select('*, clientes(nome, whatsapp), planos(nome, valor_mensal)')
      .eq('status', 'ativa')
      .lte('data_renovacao', em10dias.toISOString().split('T')[0])
      .gte('data_renovacao', hoje.toISOString().split('T')[0])
      .order('data_renovacao')
    if (error) throw error
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar renovações' })
  }
})

// PUT /assinaturas/:id/renovar
router.put('/assinaturas/:id/renovar', autenticar, TODOS, async (req, res) => {
  try {
    const { nova_data_renovacao, vendedor_id, forma_pgto } = req.body
    const { data: ass } = await supabaseAdmin
      .from('assinaturas').select('*, planos(valor_mensal)').eq('id', req.params.id).single()
    if (!ass) return res.status(404).json({ erro: 'Assinatura não encontrada' })

    const novaData = nova_data_renovacao || (() => {
      const d = new Date(ass.data_renovacao)
      d.setMonth(d.getMonth() + 1)
      return d.toISOString().split('T')[0]
    })()

    await supabaseAdmin.from('assinaturas').update({
      data_renovacao: novaData,
      status: 'ativa',
      vendedor_id: vendedor_id || ass.vendedor_id,
      forma_pgto: forma_pgto || ass.forma_pgto
    }).eq('id', req.params.id)

    // Registra cobrança
    await supabaseAdmin.from('cobrancas_assinatura').insert({
      assinatura_id: req.params.id,
      valor: ass.planos?.valor_mensal || 0,
      data_cobranca: new Date().toISOString().split('T')[0],
      forma_pgto: forma_pgto || ass.forma_pgto,
      status: 'pago'
    })

    return res.json({ mensagem: 'Renovação realizada', nova_data: novaData })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao renovar assinatura' })
  }
})

// ============================================================
// #17 AGENDAMENTO = COMANDA AUTOMÁTICA
// ============================================================

// POST /agendamentos/:id/abrir-comanda — cria comanda ao confirmar agendamento
router.post('/agendamentos/:id/abrir-comanda', autenticar, TODOS, async (req, res) => {
  try {
    const { data: ag } = await supabaseAdmin
      .from('agendamentos')
      .select('*, servicos(nome, valor)')
      .eq('id', req.params.id).single()
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    // Verifica se já existe comanda para este agendamento
    const { data: existente } = await supabaseAdmin
      .from('comandas').select('id').eq('agendamento_id', req.params.id).single()
    if (existente) return res.json({ comanda_id: existente.id, mensagem: 'Comanda já existia' })

    // Cria comanda
    const { data: comanda, error } = await supabaseAdmin
      .from('comandas')
      .insert({
        agendamento_id: req.params.id,
        cliente_id:     ag.cliente_id,
        colaborador_id: ag.colaborador_id,
        unidade_id:     ag.unidade_id,
        criado_por:     req.usuario.id
      }).select().single()
    if (error) throw error

    // Adiciona serviço como item da comanda
    await supabaseAdmin.from('itens_comanda').insert({
      comanda_id: comanda.id,
      tipo:       'servico',
      servico_id: ag.servico_id,
      descricao:  ag.servicos?.nome || 'Serviço',
      quantidade: 1,
      valor_unit: ag.valor || 0
    })

    return res.status(201).json({ comanda_id: comanda.id })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao abrir comanda' })
  }
})

// ============================================================
// #18 BARCODE — busca produto por EAN
// (já existe em /produtos/por-barcode/:barcode no cadastros.js)
// ============================================================

// ============================================================
// #8 VALIDAÇÕES DE AGENDAMENTO
// ============================================================

// GET /agendamentos/pode-cancelar/:id — verifica se pode cancelar (15 min antes)
router.get('/agendamentos/pode-cancelar/:id', autenticar, async (req, res) => {
  try {
    const { data: ag } = await supabaseAdmin
      .from('agendamentos').select('data_hora_ini, status').eq('id', req.params.id).single()
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const ini      = new Date(ag.data_hora_ini)
    const agora    = new Date()
    const diffMin  = (ini - agora) / 60000
    const podeCancelar = diffMin >= 15

    return res.json({
      pode_cancelar: podeCancelar,
      minutos_restantes: Math.round(diffMin),
      mensagem: podeCancelar
        ? 'Cancelamento permitido'
        : 'Cancelamento não permitido — menos de 15 minutos para o início'
    })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao verificar cancelamento' })
  }
})

// ============================================================
// IMPORTAÇÃO DE HISTÓRICO DE SERVIÇOS
// ============================================================

router.post('/historico-servicos', autenticar, exigirPerfil('proprietario'), async (req, res) => {
  try {
    const { unidade_slug, servico_nome, cliente_nome, cliente_fone, profissional, data, valor, forma_pgto, pontos, status } = req.body

    // Busca unidade
    const unidadeMap = { timbauva: 'Unidade Timbaúva', centro: 'Unidade Centro', saojoao: 'Unidade São João' }
    const { data: unidade } = await supabaseAdmin.from('unidades').select('id').eq('nome', unidadeMap[unidade_slug] || unidade_slug).single()
    if (!unidade) return res.status(404).json({ erro: 'Unidade não encontrada' })

    // Busca ou cria cliente
    let cliente_id = null
    if (cliente_fone) {
      const fone = cliente_fone.replace(/\D/g,'').slice(-11)
      const { data: cli } = await supabaseAdmin.from('clientes').select('id').eq('whatsapp', fone).single()
      if (cli) cliente_id = cli.id
    }
    if (!cliente_id && cliente_nome) {
      const { data: cli } = await supabaseAdmin.from('clientes').select('id').ilike('nome', cliente_nome).single()
      if (cli) cliente_id = cli.id
    }

    // Busca colaborador
    let colaborador_id = null
    if (profissional) {
      const { data: col } = await supabaseAdmin.from('colaboradores').select('id').ilike('nome', `%${profissional}%`).eq('unidade_id', unidade.id).single()
      if (col) colaborador_id = col.id
    }

    // Busca serviço
    let servico_id = null
    if (servico_nome) {
      const { data: svc } = await supabaseAdmin.from('servicos').select('id').ilike('nome', `%${servico_nome}%`).single()
      if (svc) servico_id = svc.id
    }

    // Converte data
    let data_hora = null
    if (data) {
      try {
        const d = new Date(data)
        data_hora = isNaN(d) ? null : d.toISOString()
      } catch { data_hora = null }
    }

    // Converte status
    const statusMap = { 'Concluído': 'concluido', 'Cancelado': 'cancelado', 'Não compareceu': 'nao_compareceu' }
    const status_norm = statusMap[status] || 'concluido'

    // Insere no histórico
    await supabaseAdmin.from('historico_atendimentos').insert({
      unidade_id:     unidade.id,
      cliente_id,
      colaborador_id,
      servico_id,
      data_hora_ini:  data_hora,
      valor:          parseFloat(valor) || 0,
      forma_pgto:     (forma_pgto || '').toLowerCase().replace(/\s/g,'_'),
      status:         status_norm,
      pontos_gerados: parseInt(pontos) || 0,
      origem:         'importacao_appbarber'
    })

    return res.status(201).json({ ok: true })
  } catch (err) {
    console.error('[importacao]', err)
    return res.status(500).json({ erro: 'Erro ao importar registro' })
  }
})

module.exports = router
