# Tago Backend — ERP de Ativos (Fases 1, 2 e 3 concluídas)

Backend em Node.js + Express + MongoDB (Mongoose), evoluído do protótipo
inicial pra virar a base de um ERP completo de gestão de ativos: chips,
rastreadores, conversores, transmissores, bóias e outros equipamentos.

## O que mudou nesta fase

Esta é uma reformulação de arquitetura, não um ajuste incremental:

- **Login com JWT** — `User` (Administrador / Consulta), seed automático de
  um admin na primeira subida se não existir nenhum usuário.
- **`Equipment` com discriminators do Mongoose** substitui o antigo `Device`.
  Uma única coleção cobre Rastreador, Conversor, Transmissor, Bóia e Outro —
  evita duplicar schema/lógica 5 vezes, e ainda permite campos específicos
  por categoria (ex: só Rastreador tem `imei` e `chip_id`).
- **`disponivel` é campo calculado**, não gravado: `configurado && testado &&
  status === 'EM_ESTOQUE'`. Segue a regra do documento ("quando configurado
  e testado, o sistema identifica automaticamente que está disponível") sem
  guardar um estado que poderia dessincronizar.
- **`Chip`** com os 4 status que viram as abas do módulo: `EM_ESTOQUE`,
  `INSTALADO`, `ENTREGUE`, mais `PERDIDO`/`BLOQUEADO`.
- **Fluxo de instalação de chip** (`POST /api/chips/:id/instalar`) implementa
  exatamente a regra pedida: busca o rastreador pelo IMEI, cancela se não
  achar, associa direto se o rastreador estiver livre, ou pede confirmação
  de troca se já tiver outro chip (e aí devolve o antigo pro estoque
  automaticamente).
- **`Tecnico`** e **`FranquiaCliente`** como cadastros próprios, separados de
  `Unit` (Unidade).
- **`HistoryLog`** genérico — qualquer entidade pode logar quem fez o quê,
  quando, e o antes/depois dos campos alterados.
- **Busca Global** (`GET /api/busca?q=...`) cruza IMEI, ICCID, número,
  modelo, unidade, franquia/cliente e técnico numa chamada só.
- Toda rota (exceto `/api/auth/login` e `/api/health`) agora exige token.
  Ações de escrita (criar/editar/excluir) exigem `tipo: ADMINISTRADOR`.

## Como rodar

```bash
npm install
cp .env.example .env
```

Preencha no `.env`:
- `MONGODB_URI` — sua connection string do Atlas
- `JWT_SECRET` — qualquer string longa e aleatória (só você precisa saber)
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_SENHA` — opcional; se deixar a senha em
  branco, uma senha aleatória é gerada e **impressa no console** na primeira
  vez que o servidor sobe (guarde ela, só aparece uma vez)

```bash
npm start
```

Depois faça login em `POST /api/auth/login` com `{ "email": "...", "senha": "..." }`
pra pegar o token — todas as outras chamadas precisam do header
`Authorization: Bearer SEU_TOKEN`.

## Endpoints principais

| Módulo | Rota base | Observação |
|---|---|---|
| Autenticação | `/api/auth` | `POST /login`, `GET /me` |
| Usuários | `/api/users` | Só Administrador cria/edita/exclui |
| Chips | `/api/chips` | Inclui `/instalar`, `/entregar`, `/liberar`, `/status` |
| Equipamentos | `/api/equipamentos` | `?categoria=RASTREADOR\|CONVERSOR\|TRANSMISSOR\|BOIA\|OUTRO`, mais `/:id/acessorios` e `/:id/vincular-rastreador` |
| Unidades | `/api/units` | Cadastro auxiliar |
| Técnicos | `/api/tecnicos` | Cadastro auxiliar |
| Franquias/Clientes | `/api/franquias-clientes` | Cadastro auxiliar |
| Dashboard | `/api/dashboard/resumo` | Contagem por card |
| Histórico | `/api/historico` | Filtra por `entidade_tipo` e `entidade_id` |
| Busca global | `/api/busca?q=texto` | Cruza todas as entidades |

## ⚠️ Pendências conhecidas

1. **Conversor/Transmissor ↔ Rastreador** já tem endpoints prontos
   (`POST /:id/vincular-rastreador`, `GET /:id/acessorios`) e está integrado
   no frontend.
2. **Migração de dados**: `scripts/importFromExcel.js` foi reescrito pro
   novo modelo (`Equipment` categoria `RASTREADOR` + novos status de chip) e
   testado em `--dry-run` contra a planilha real: 626 rastreadores, 1123
   chips, 505 unidades, só 1 linha sinalizada pra revisão manual.
   - Status antigo "Perdido" de equipamento não existe mais como estado —
     vira exclusão lógica (`ativo:false`) com a observação preservando o
     motivo, já que o novo fluxo de equipamento não tem essa opção (só chip
     tem "Perdido").
   - Chips antigos "Cancelado"/"Defeito" migram pra `BLOQUEADO`.
3. **Paginação** nas listagens — ok pro volume atual (~1700 registros),
   mas vale considerar se crescer muito.
4. Classificação automática de "Unidade" vs "Franquia/Cliente" durante a
   importação não foi feita — todos os registros da planilha antiga viram
   `Unit`. Separar manualmente os que são franquia/cliente de verdade é
   trabalho futuro, se necessário.
