# Time-Off Microservice

Microserviço de gerenciamento de folgas construído com **NestJS 11**, **SQLite** e **TypeORM 0.3**. Implementa o ciclo de vida completo de solicitações de time-off com state machine, RBAC por location, sincronização com HCM e reconciliação batch.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 18.x |
| npm | 9.x |

Sem Docker, sem Redis, sem banco externo — apenas Node + SQLite em arquivo local.

---

## Setup

```bash
cd time-off-microservice
npm install
```

O arquivo `.env` já existe com valores de desenvolvimento. Para customizar, edite-o diretamente.

**Variáveis de ambiente:**

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `NODE_ENV` | `development` | Ambiente (`development` / `production`) |
| `JWT_SECRET` | `dev-secret-key-not-for-production` | Chave secreta JWT — troque em produção |
| `JWT_EXPIRES_IN` | `8h` | Expiração do token |
| `DB_PATH` | `./data/timeoff.db` | Caminho do banco SQLite |
| `DB_LOGGING` | `false` | Log de queries SQL (`true` / `false`) |
| `HCM_BASE_URL` | `http://localhost:3001` | URL base do sistema HCM |
| `HCM_PATH_PREFIX` | `/mock-hcm` | Prefixo dos paths do HCM. Rotas internas (`/balances`, `/time-off`, `/time-off/:id/cancel`, `/batch`) são relativas. Trocar para o prefixo real ao apontar para um HCM de produção. |
| `HCM_TIMEOUT_MS` | `10000` | Timeout de requisição HCM (ms) |
| `HCM_MAX_RETRIES` | `3` | Tentativas com backoff exponencial (1s, 2s, 4s) |
| `GRACE_PERIOD_HOURS` | `24` | Janela de grace period antes do startDate |
| `WEBHOOK_SECRET` | `dev-webhook-secret-change-me` | Segredo para autenticar webhooks do HCM (vazio = desabilitado) |

---

## Execução

```bash
# Desenvolvimento (hot-reload, schema auto-sync, seed automático)
npm run start:dev

# Produção (requer migration:run antes)
npm run build
npm run start:prod
```

Na **primeira execução em desenvolvimento**, o banco é criado em `./data/timeoff.db` e populado automaticamente com:

| Usuário | Role | Location | Senha |
|---|---|---|---|
| `manager@company.com` | MANAGER | loc-001, loc-002 | `Password123` |
| `alice@company.com` | EMPLOYEE | loc-001 | `Password123` |
| `bob@company.com` | EMPLOYEE | loc-001 | `Password123` |

O seed é idempotente: se o banco já tiver usuários, o seed é ignorado.

---

## Migrations (produção)

Em produção (`NODE_ENV=production`) o schema **não é sincronizado automaticamente**. Use os scripts de migration:

```bash
# Aplicar todas as migrations pendentes
npm run migration:run

# Reverter a última migration
npm run migration:revert

# Listar status das migrations
npm run migration:show

# Gerar nova migration a partir de mudanças nas entities
npm run migration:generate -- src/database/migrations/006-nome-da-migration
```

As migrations ficam em `src/database/migrations/` e a configuração do CLI em `src/database/data-source.ts`.

---

## API

Todos os endpoints são prefixados com `/api`. O servidor responde na porta `3000` por padrão.

### Usuários e Autenticação

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/users` | — | Criar usuário |
| `POST` | `/api/users/login` | — | Login — retorna `accessToken` JWT |
| `POST` | `/api/users/roles` | JWT + MANAGER | Atribuir role a usuário por location |
| `GET` | `/api/users/:id` | JWT | Buscar usuário por ID |

### Saldos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/balances?employeeId=X&locationId=Y` | JWT + location | Consultar saldo efetivo |

O saldo efetivo é calculado em tempo real:
```
effectiveBalance = hcmBalance − SUM(daysRequested WHERE status IN PENDING, APPROVED, IN_SYNC)
```

### Campo `manualReviewReason`

Todo `RequestOutput` retornado pela API inclui o campo `manualReviewReason: string | null`. Valores possíveis:
- `null` — sem revisão pendente (caso normal)
- `"HCM_REVERSAL_REJECTED:<mensagem>"` — tentativa de cancelamento de request COMPLETED foi rejeitada pelo HCM. Request permanece COMPLETED até resolução manual.

### Solicitações de Folga

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/requests` | JWT + EMPLOYEE/MANAGER + location | Submeter solicitação |
| `PATCH` | `/api/requests/:id/approve` | JWT + MANAGER | Aprovar |
| `PATCH` | `/api/requests/:id/reject` | JWT + MANAGER | Rejeitar |
| `PATCH` | `/api/requests/:id/cancel` | JWT | Cancelar (owner ou MANAGER) |
| `GET` | `/api/requests/:id` | JWT | Buscar solicitação por ID |
| `GET` | `/api/requests?employeeId=X` | JWT | Listar solicitações do empregado |

### Webhook HCM

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/webhooks/hcm/balance` | `X-Webhook-Secret` | Receber atualização de saldo do HCM |

Payload esperado:
```json
{
  "employeeId": "uuid",
  "locationId": "loc-001",
  "balance": 18,
  "generatedAt": "2026-01-01T00:00:00Z",
  "generatedAtTimestamp": 1735689600
}
```

---

## Fluxo Rápido (Thunder Client / Postman)

```
1. POST /api/users/login          → { accessToken }
2. POST /api/requests             → { id } (header: Authorization: Bearer <token>)
3. PATCH /api/requests/:id/approve
4. GET  /api/balances?employeeId=...&locationId=...
```

---

## State Machine de Requests

```
                    submit
                  ──────────► PENDING ──cancel──► CANCELLED
                                 │
                              approve
                                 │
                              APPROVED ──cancel──► CANCELLED
                                 │
                          sync (cron 5min)
                                 │
                              IN_SYNC ──cancel──► CANCELLED
                              ┌──┴──┐
                           complete  fail
                              │       │
                          COMPLETED  FAILED
                              │
                        cancel (c/ HCM reversal)
                              │
                           CANCELLED
```

**Grace period** (padrão: 24h antes do `startDate`):
- `approve`: permitido apenas dentro do grace period
- `cancel` de APPROVED por employee: permitido apenas dentro do grace period
- `cancel` de APPROVED por MANAGER: sempre permitido

**Cancel de COMPLETED**: envia reversal ao HCM. Se HCM confirmar, status vira CANCELLED. Se HCM rejeitar, o request permanece COMPLETED, o campo `manualReviewReason` é preenchido com `HCM_REVERSAL_REJECTED:<motivo>` e um audit `cancel_attempt_failed` é registrado. API retorna `403 ForbiddenError`. Operadores listam casos pendentes com:

```sql
SELECT * FROM time_off_requests WHERE manualReviewReason IS NOT NULL;
```

---

## RBAC

Cada usuário tem roles por location (`user_location_roles`). Ao autenticar, o JWT strategy carrega todas as roles e constrói o `IActor` com:
- `roles[]` — lista de `{ locationId, role }`
- `employeeLocationIds[]` — locations onde é EMPLOYEE
- `managedLocationIds[]` — locations onde é MANAGER

Guards aplicados por endpoint:

| Endpoint | Guards |
|---|---|
| `POST /requests` | `JwtGuard` → `RolesGuard` → `LocationAccessGuard` |
| `PATCH /requests/:id/approve` | `JwtGuard` → `RolesGuard(MANAGER)` → `RequestLocationGuard` |
| `PATCH /requests/:id/reject` | `JwtGuard` → `RolesGuard(MANAGER)` → `RequestLocationGuard` |
| `PATCH /requests/:id/cancel` | `JwtGuard` → `RequestLocationGuard` |
| `GET /requests/:id` | `JwtGuard` → `RequestLocationGuard` |
| `GET /balances` | `JwtGuard` → `LocationAccessGuard` |

- `RolesGuard` checa `@Roles(...)` contra `actor.roles.map(r => r.role)`
- `LocationAccessGuard` extrai `locationId` do body/params/query e valida presença em `actor.roles`
- `RequestLocationGuard` (defesa em camadas) carrega o request pelo `:id`, lê seu `locationId` e valida

Em cima dos guards, o service ainda faz `validateManagerAccess` (aprovar/rejeitar) e checagem owner-ou-manager (cancelar) como segunda linha.

---

## Arquitetura de Módulos

```
src/
├── shared/          # BaseRepository<T>, BaseError, 11 exceptions, DateUtil, UuidUtil, GlobalExceptionFilter
├── auth/            # JwtStrategy, JwtGuard, RolesGuard, LocationAccessGuard, @CurrentActor, @Roles
├── database/
│   ├── migrations/  # 001–006: 5 tabelas + manualReviewReason
│   ├── seed/        # SeedService — popula banco na primeira execução (dev only)
│   └── data-source.ts  # DataSource para CLI de migrations
├── user/            # UserEntity, UserLocationRoleEntity, UserRepository (read), UserWriteRepository, UserRoleRepository, UserService
├── balance/         # BalanceEntity, BalanceReadRepository, BalanceWriteRepository, BalanceService (optimistic locking)
├── request/         # TimeOffRequestEntity, RequestStateMachine, RequestService (transactions atômicas), RequestAuditRepository, RequestLocationGuard
├── hcm/             # HcmClient — ACL com retry exponencial (1s/2s/4s), timeout 10s, paths por HCM_PATH_PREFIX
├── sync/            # SyncService (real-time + batch), SyncCron (every_5min + 2AM)
└── webhook/         # WebhookController — POST /webhooks/hcm/balance

test/
├── mock-hcm/        # Mock HCM server para testes E2E (suporta X-Simulate-Timeout e X-Simulate-Error)
└── app.e2e-spec.ts  # Testes E2E com SQLite :memory:
```

### Padrões arquiteturais

- **CQRS pragmático**: módulos `request`, `balance` e `user` separam repositórios de leitura e escrita
- **Transactions atômicas**: toda mudança de status + audit log em `RequestService` ocorre em `DataSource.transaction()`
- **Interface-first**: cada service e repositório implementa uma interface TypeScript dedicada
- **BaseError hierarchy**: 11 exceptions específicas com `code`, `httpStatus`, `details` → mapeadas pelo `GlobalExceptionFilter`
- **Dual date columns**: ISO string (display) + UNIX timestamp (queries) em todas as entidades com datas
- **Optimistic locking**: `@VersionColumn` em `BalanceEntity` com retry loop (até 3x)
- **WAL mode**: `PRAGMA journal_mode=WAL` + `busy_timeout=5000` para leituras concorrentes no SQLite

---

## Banco de Dados

### Tabelas e Índices

| Tabela | Índices relevantes |
|---|---|
| `users` | `UNIQUE(email)` |
| `user_location_roles` | `UNIQUE(userId, locationId, role)`, `INDEX(userId)`, `INDEX(locationId, role)` |
| `employee_balances` | `UNIQUE(employeeId, locationId)`, `@VersionColumn` |
| `time_off_requests` | `UNIQUE(idempotencyKey)`, `INDEX(employeeId, status)`, `INDEX(status)`, `INDEX(employeeId, startDateTimestamp, endDateTimestamp)`, `INDEX(manualReviewReason)` |
| `request_audit_log` | `INDEX(requestId)`, `INDEX(actorId)` |

---

## Testes

```bash
# Testes unitários (todos os módulos)
npm run test

# Testes unitários com watch
npm run test:watch

# Testes E2E (SQLite in-memory + mock HCM)
npm run test:e2e

# Cobertura de código
npm run test:cov

# Verificar formatação (sem alterar arquivos)
npm run format:check

# Lint
npm run lint
```

### Cobertura atual

Última execução: **97.96% statements**, **98.04% lines**, **95.3% methods**, **79.32% branches** — 221 testes passando em 32 suites.

Arquivos excluídos da cobertura (via `jest.config.json`): `*.module.ts`, `main.ts`, `*.interface.ts`, `index.ts`, `database/migrations/**`, `database/data-source.ts`, `**/dto/**`, `**/entities/**`. Esses arquivos são pura configuração ou contêm apenas decorators TypeORM / class-validator, sem lógica runtime para testar.

### Estrutura de testes

Cada arquivo de implementação tem um `.spec.ts` correspondente na pasta `__tests__/` do seu módulo. Testes E2E usam o mock HCM server embutido (sem servidor externo necessário).

---

## Decisões Técnicas

Consulte [docs/decisions.md](./docs/decisions.md) para o log completo de decisões e resolução de ambiguidades do TRD.

Principais decisões:
- **WAL mode configurado em dois lugares** (TypeORM `extra.pragma` + `main.ts` PRAGMA direto) — redundância intencional para garantia de ativação
- **Sync não é imediato no approve** — cron de 5min como fallback; evita bloquear a resposta HTTP
- **HCM paths configuráveis via `HCM_PATH_PREFIX`** — default `/mock-hcm` para desenvolvimento; sobrescrever em produção
- **Cancel de COMPLETED com falha no HCM** — request permanece COMPLETED, `manualReviewReason` persistido + audit `cancel_attempt_failed`, erro 403 para o cliente, query SQL para operadores listar pendências
- **Transactions atômicas em todas as mutações de request** — status + audit log sempre em `DataSource.transaction()`
- **Defesa em camadas nos endpoints de request** — `RequestLocationGuard` no controller + `validateManagerAccess` no service
- **UserRoleRepository unificado** — tabela join simples, separação read/write seria burocracia sem benefício real
- **Entities e DTOs excluídos da cobertura** — são decorators TypeORM / class-validator sem lógica runtime
