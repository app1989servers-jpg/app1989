// ============================================================
// BASE DE CONHECIMENTO — APP 1989
// Carregada dinamicamente pelo assistente
// Pode ser sobrescrita pela tabela 'knowledge_base' no Supabase
// ============================================================

const KNOWLEDGE_BASE = {

  gestao_barbearia: `
=== GESTÃO DE BARBEARIA ===

PRECIFICAÇÃO POR VALOR (não por custo):
- Preço deve refletir experiência + resultado, não apenas tempo
- Regra: custo do serviço × 3 = preço mínimo saudável
- Reajuste anual mínimo de 8-12% (inflação + valorização)
- Serviços premium justificam preço 40-60% acima da média local
- Nunca compete por preço — compete por experiência e resultado

RETENÇÃO DE CLIENTES (a métrica mais importante):
- Custo de adquirir cliente novo = 5-7x o custo de reter um existente
- Cliente que retorna em menos de 21 dias tem 80% de chance de fidelização
- Após 3 visitas consecutivas, taxa de abandono cai para menos de 10%
- Lembrete automático no 14º dia aumenta retorno em 35%
- NPS acima de 8.5 = cliente promotor ativo (indica para outros)

GESTÃO DE AGENDA:
- Taxa de ocupação ideal: 75-85% (100% não deixa margem para encaixes)
- Horários de pico: sexta 17h-20h, sábado 8h-12h (monetize mais nesses slots)
- Horários ociosos (seg/ter manhã): ideal para pacotes e promoções específicas
- Taxa de no-show acima de 15% = problema de confirmação (automatize lembretes)
- Bloqueio de horário do almoço reduz produtividade em 20% — escalone os almoços

TICKET MÉDIO — como aumentar:
- Objetivo: todo atendimento de corte deve incluir uma oferta de serviço adicional
- Barbeiro que oferece produto a cada 3 clientes aumenta ticket médio em 22%
- Combo corte + barba: margem 40% maior que serviços separados
- Venda de produto no momento pós-serviço (cliente satisfeito) tem taxa 3x maior
`,

  vendas_upsell: `
=== VENDAS E UPSELL ===

SPIN SELLING (Neil Rackham) — adaptado para barbearia:
- Situação: "Você costuma usar algum produto no cabelo?"
- Problema: "Seu cabelo fica com frizz quando não usa nada?"
- Implicação: "Isso afeta como você se sente no trabalho/dia a dia?"
- Necessidade: "Se eu te mostrar o que o deixa do jeito que ficou agora, faz sentido?"
→ Nunca ofereça produto sem antes criar a necessidade com perguntas

NEVER SPLIT THE DIFFERENCE (Chris Voss):
- Técnica do espelho: repita as últimas 3 palavras do cliente como pergunta
- "Você quer manter o tamanho?" → cliente elabora e você descobre o que realmente quer
- Ancoragem: mencione o valor cheio antes de apresentar o combo com desconto
- "Normalmente o corte + barba separados sai R$85 — junto hoje sai R$75"

$100M OFFERS (Alex Hormozi):
- Oferta irresistível = resultado desejado + prazo + garantia + bônus
- Exemplo: "Plano Premium: corte toda semana + barba inclusa + produto no final = R$139/mês"
- Empilhe valor antes de revelar preço
- Remova o risco: "Se não gostar do corte, refaço sem custo"

RECEITA PREVISÍVEL (Aaron Ross):
- Planos de assinatura = receita recorrente previsível
- 1 cliente de plano premium = R$1.668/ano garantidos
- 50 assinantes = R$6.950/mês fixos, independente do movimento
- Meta: converter 20% da base ativa para algum plano

TÉCNICAS DE UPSELL NA CADEIRA:
1. Oferta no início: "Hoje vou fazer o degradê — quer aproveitar e fazer a barba também?"
2. Produto na saída: "Usei essa pomada em você — quer levar para manter em casa?"
3. Próxima visita: "Daqui 15 dias esse corte vai estar precisando — já agendo?"
4. Indicação: "Você tem amigo que quer cortar? Traz que você ganha 10% de desconto"
`,

  lideranca_equipe: `
=== LIDERANÇA E GESTÃO DE EQUIPE ===

THE FIVE DYSFUNCTIONS OF A TEAM (Patrick Lencioni):
- Ausência de confiança → medo de conflito → falta de comprometimento → fuga de responsabilidade → inatenção a resultados
- Base: o líder precisa ser vulnerável primeiro para criar confiança
- Reunião semanal de 15 min com a equipe elimina 80% dos problemas de comunicação
- Feedback individual mensal (não apenas quando há problema)

EXTREME OWNERSHIP (Jocko Willink):
- Todo problema da equipe é problema do líder primeiro
- Barbeiro com baixa performance = líder não treinou, não acompanhou ou não deu ferramentas
- "Cover and Move": equipe protege uns aos outros — barbeiro ocupado, colega ajuda na recepção
- Descentralize decisões: barbeiro confiante toma mais iniciativa e vende mais

DRIVE (Daniel Pink) — o que motiva pessoas:
- Autonomia: deixe barbeiro personalizar o atendimento (não só executar)
- Maestria: treinamentos mensais, competição saudável com ranking
- Propósito: "Somos a melhor barbearia de Montenegro" — reforce isso toda semana

FEEDBACK DE ALTA PERFORMANCE:
- Modelo SBI: Situação → Comportamento → Impacto
- "Na sexta (S), você não ofereceu o produto ao cliente (C) — ele saiu sem comprar nada extra (I)"
- Frequência: 1 elogio público para cada correção privada
- Meta mensal por barbeiro: definida junto, não imposta

COACHING DE BARBEIROS:
- Acompanhe 1 atendimento por semana (observe, não interfira)
- Debriefe depois: "O que foi bem? O que faria diferente?"
- Use os dados do sistema: mostre o número de horários ociosos e pergunte como preencher
- Barbeiro que participa da solução implementa com mais comprometimento
`,

  marketing_fidelizacao: `
=== MARKETING LOCAL E FIDELIZAÇÃO ===

BUILDING A STORYBRAND (Donald Miller):
- O cliente é o herói, você é o guia
- Mensagem: "Você quer se sentir bem toda semana? A Barbearia 1989 cuida disso por você"
- Evite falar de você — fale do resultado que o cliente terá
- Tagline simples: "Montenegro se cuida na 1989"

CONTAGIOUS (Jonah Berger) — o que faz as pessoas indicarem:
- Moeda social: cliente que indica recebe algo exclusivo (não desconto genérico)
- Gatilhos: o que lembra o cliente da barbearia no dia a dia? (produto com logo, cheiro, música)
- Emoção: clientes que saem se sentindo bem indicam mais — invista no ritual do atendimento
- Visibilidade: cadeira com espelho na vitrine, cheiro de produto na calçada

CAMPANHAS SEGMENTADAS POR COMPORTAMENTO:
- Cliente que não vem há 15 dias → WhatsApp pessoal do barbeiro preferido
- Cliente que nunca comprou produto → oferta de produto relacionado ao serviço que usa
- Cliente de plano básico → upgrade para premium com 1 mês de desconto
- Aniversariante do mês → mensagem no dia + serviço com desconto ou cortesia
- Cliente novo (1ª visita) → mensagem de agradecimento + convite para retorno

MARKETING DE CONTEÚDO LOCAL:
- Instagram: antes/depois de cortes (peça permissão) + bastidores da equipe
- Google Meu Negócio: solicite avaliação no WhatsApp 2h após o atendimento
- Stories diários: "Horário disponível hoje às 15h com o Rodrigo — chama no WhatsApp"
- Reels de transformação: maior engajamento orgânico para barbearias

FIDELIZAÇÃO — o sistema de pontos simples:
- 10 visitas = 1 serviço gratuito (simples de comunicar)
- Aniversário: serviço com 20% desconto (gera Word of Mouth)
- Indicação bem-sucedida: desconto na próxima visita para quem indicou
- Plano mensal: maior ferramenta de fidelização — cliente com plano cancela 4x menos
`,

  mentalidade_crescimento: `
=== MENTALIDADE E CRESCIMENTO ===

GOOD TO GREAT (Jim Collins):
- Conceito do Ouriço: faça uma coisa melhor que todos no mundo
- Para barbearia: experiência de atendimento + resultado técnico + conveniência
- "First Who, Then What": contrate pessoas certas antes de definir estratégia
- Cultura de disciplina: processos claros liberam a equipe para ser excelente

SCALING UP (Verne Harnish):
- Ritmo de reuniões: diária (5 min), semanal (60 min), mensal (estratégia)
- OKRs simplificados: 1 grande meta trimestral por unidade + 3 ações-chave
- Dashboard de métricas visível para toda equipe (torna performance tangível)
- Gargalo número 1 de crescimento: quase sempre é processo, não pessoa

THE E-MYTH (Michael Gerber):
- Trabalhe NO negócio E NO negócio — não apenas dentro dele
- Sistema > talento individual: documente tudo para ser replicável
- Franquia mental: "Se eu abrisse mais uma unidade amanhã, o que precisaria estar escrito?"
- Proprietário que corta cabelo 8h/dia não consegue crescer — precisa de sistemas

MÉTRICAS QUE IMPORTAM (KPIs de barbearia):
- Taxa de retenção mensal (meta: acima de 70%)
- Ticket médio por atendimento (meta: crescer 10% ao ano)
- Taxa de conversão para planos (meta: 20% da base ativa)
- NPS médio (meta: acima de 8.5)
- Ocupação da agenda (meta: 75-85%)
- Taxa de no-show (meta: abaixo de 10%)
`
}

// Carrega knowledge base do Supabase (se houver entradas customizadas)
async function loadKnowledge(supabaseAdmin) {
  try {
    const { data } = await supabaseAdmin
      .from('knowledge_base')
      .select('categoria, conteudo')
      .eq('ativo', true)
      .order('criado_em', { ascending: false })

    if (data && data.length > 0) {
      const customKnowledge = data.map(k => `\n=== ${k.categoria.toUpperCase()} (PERSONALIZADO) ===\n${k.conteudo}`).join('\n')
      return Object.values(KNOWLEDGE_BASE).join('\n') + '\n' + customKnowledge
    }
  } catch (e) {
    // Se tabela não existir ainda, usa só o knowledge base padrão
  }
  return Object.values(KNOWLEDGE_BASE).join('\n')
}

module.exports = { KNOWLEDGE_BASE, loadKnowledge }
