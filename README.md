# APP 1989 — Backend

API REST do sistema de gestão da Barbearia 1989.

## Requisitos

- Node.js 18+
- Conta no Supabase (gratuita)
- Schema SQL já rodado no Supabase

## Instalação local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do Supabase

# 3. Rodar em desenvolvimento
npm run dev

# 4. Testar
curl http://localhost:3001/health
```

## Variáveis de ambiente obrigatórias

```
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=eyJ...          # Settings → API → anon public
SUPABASE_SERVICE_KEY=eyJ...       # Settings → API → service_role (NUNCA exponha)
JWT_SECRET=string_aleatoria_longa
```

## Como encontrar as chaves no Supabase

1. Acesse seu projeto no supabase.com
2. Menu lateral → **Settings** (engrenagem)
3. Clique em **API**
4. Copie:
   - **Project URL** → SUPABASE_URL
   - **anon public** → SUPABASE_ANON_KEY
   - **service_role** → SUPABASE_SERVICE_KEY

## Rotas principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /auth/login | Login todos os perfis |
| POST | /auth/cadastro-cliente | Cadastro de cliente |
| GET | /agendamentos/hoje | Agenda do dia |
| GET | /agendamentos/horarios-disponiveis | Slots disponíveis |
| POST | /agendamentos | Criar agendamento |
| PUT | /agendamentos/:id/status | Atualizar status |
| GET | /comandas | Listar comandas |
| POST | /comandas | Abrir comanda |
| POST | /comandas/:id/itens | Adicionar item |
| PUT | /comandas/:id/finalizar | Finalizar comanda |
| GET | /financeiro/resumo | Resumo financeiro |
| GET | /financeiro/comissoes | Comissões por barbeiro |
| GET | /unidades | Listar unidades |
| GET | /colaboradores | Listar colaboradores |
| GET | /clientes | Listar clientes |
| GET | /servicos | Listar serviços |
| GET | /produtos | Listar produtos |
| GET | /planos | Listar planos |

## Deploy no Railway (gratuito)

1. Crie conta em railway.app
2. Clique em **New Project → Deploy from GitHub**
3. Selecione este repositório
4. Vá em **Variables** e adicione todas as variáveis do .env
5. Railway faz o deploy automaticamente
6. Copie a URL gerada (ex: app1989.up.railway.app)

## Autenticação

Todas as rotas (exceto /auth/*) exigem o header:
```
Authorization: Bearer SEU_TOKEN_JWT
```

O token é retornado no login e expira em 12 horas.
