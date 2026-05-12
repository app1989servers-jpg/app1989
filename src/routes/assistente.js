const express = require('express')
const router  = express.Router()
const { supabaseAdmin } = require('../config/supabase')
const { autenticar, exigirPerfil } = require('../middleware/auth')

// POST /assistente/chat
// Apenas proprietário e gerente têm acesso
router.post('/chat', autenticar, exigirPerfil('proprietario', 'gerente'), async (req, res) => {
  try {
    const { mensagem, historico = [] } = req.body
    if (!mensagem) return res.status(400).json({ erro: 'Mensagem é obrigatória' })

    // ---- Coleta dados reais do banco ----
    const [
      { data: finHoje },
      { data: finMes },
      { data: agendaHoje },
      { data: comissoes },
      { data: estoque },
      { data: reativar },
      { data: planos },
      { data: unidades }
    ] = await Promise.all([
      supabaseAdmin.from('vw_financeiro_dia').select('*').eq('data', new Date().toISOString().split('T')[0]),
      supabaseAdmin.from('comandas').select('total, forma_pgto').eq('status', 'finalizada').gte('finalizada_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabaseAdmin.from('vw_agenda_dia').select('*').gte('data_hora_ini', new Date().toISOString().split('T')[0] + 'T00:00:00').lte('data_hora_ini', new Date().toISOString().split('T')[0] + 'T23:59:59'),
      supabaseAdmin.from('vw_comissoes_mes').select('*'),
      supabaseAdmin.from('vw_estoque_alertas').select('*').eq('critico', true),
      supabaseAdmin.from('vw_clientes_reativar').select('*').limit(10),
      supabaseAdmin.from('assinaturas').select('status, planos(nome)').eq('status', 'ativa'),
      supabaseAdmin.from('unidades').select('nome').eq('ativa', true)
    ])

    // ---- Calcula resumos ----
    const fatMes   = (finMes   || []).reduce((s, c) => s + parseFloat(c.total || 0), 0)
    const fatHoje  = (finHoje  || []).reduce((s, r) => s + parseFloat(r.faturamento || 0), 0)
    const atendHoje = (agendaHoje || []).length
    const atendConcluidos = (agendaHoje || []).filter(a => a.status === 'concluido').length

    // ---- Monta contexto para o GPT ----
    const contexto = `
Você é o assistente de gestão da Barbearia 1989, uma rede de barbearias em Montenegro/RS com ${(unidades||[]).length} unidades.
Você tem acesso aos dados em tempo real do sistema e responde de forma direta, objetiva e com os números reais.
Sempre use R$ para valores monetários e formate números grandes com pontos (ex: R$ 1.840).
Quando não souber algo, diga claramente.

=== DADOS ATUAIS DO NEGÓCIO ===

📅 HOJE (${new Date().toLocaleDateString('pt-BR')}):
- Faturamento: R$ ${fatHoje.toFixed(2)}
- Agendamentos: ${atendHoje} total / ${atendConcluidos} concluídos
- Agendamentos pendentes: ${atendHoje - atendConcluidos}

📊 MÊS ATUAL:
- Faturamento total: R$ ${fatMes.toFixed(2)}
- Total de comandas finalizadas: ${(finMes||[]).length}
- Ticket médio: R$ ${(finMes||[]).length ? (fatMes / (finMes||[]).length).toFixed(2) : '0'}

💇 COMISSÕES DO MÊS:
${(comissoes||[]).map(c => `- ${c.colaborador_nome}: ${c.total_comandas} atendimentos / faturou R$ ${parseFloat(c.faturado||0).toFixed(2)} / comissão R$ ${parseFloat(c.comissao||0).toFixed(2)}`).join('\n') || '- Sem dados'}

⚠️ ESTOQUE CRÍTICO:
${(estoque||[]).length ? (estoque||[]).map(e => `- ${e.produto_nome}: ${e.quantidade} unidades (mínimo: ${e.estoque_minimo}) — ${e.unidade_nome}`).join('\n') : '- Nenhum produto em estado crítico'}

🔄 CLIENTES A REATIVAR (top 10):
${(reativar||[]).map(c => `- ${c.nome}: ${Math.round(c.dias_ausente)} dias sem visita`).join('\n') || '- Nenhum cliente a reativar'}

📋 ASSINATURAS ATIVAS:
- Total: ${(planos||[]).length} assinantes ativos

🏪 UNIDADES:
${(unidades||[]).map(u => `- ${u.nome}`).join('\n')}
`

    // ---- Chama GPT-3.5-turbo ----
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 600,
        temperature: 0.4,
        messages: [
          { role: 'system', content: contexto },
          ...historico.slice(-6), // mantém últimas 6 mensagens para contexto
          { role: 'user', content: mensagem }
        ]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Erro na API OpenAI')
    }

    const data = await response.json()
    const resposta = data.choices[0].message.content

    return res.json({
      resposta,
      tokens_usados: data.usage?.total_tokens || 0
    })

  } catch (err) {
    console.error('Erro no assistente:', err)
    return res.status(500).json({ erro: 'Erro ao processar pergunta: ' + err.message })
  }
})

module.exports = router
