# Bug & security backlog

**Правило:** пункты ниже — только учёт. **Не чинить массово**, пока не скажут «можно фиксить» (тогда брать по приоритету P0 → P1 → P2).

**Последнее обновление беклога:** 2026-03-20 (DONE-38: аудит перед продом — лимиты, Prisma 409/404, a11y диалогов, история, удалён дубликат `App.tsx`).

---

## Уже сделано (не трогать без причины)

| ID | Тема | Что сделано |
|----|------|-------------|
| DONE-01 | Скрытые `poly_*` в ленте | Деталь, ставки, комментарии, like/save проверяют скрытие (`isPolyMarketHiddenFromFeed` / категория `__hidden_market__`). |
| DONE-02 | `POST /api/users/:id/refill` | Только **ADMIN** (`requireAdmin`); самообслуживание сброса баланса убрано. |
| DONE-03 | Клиент: верификация сессии | `useEffect(verifyUser, [user?.id])` — после rehydrate из persist. |
| DONE-04 | Клиент: админ `fetchData` | Проверка `res.ok`, тосты, пустые списки при ошибке. |
| DONE-05 | Клиент: поиск пользователей + страница | `fetchData({ usersPage: 1 })` в debounce, без гонки со старым `userPage`. |
| DONE-06 | Клиент: polling баланса | Свежий `user` из `useAuthStore.getState()` внутри интервала. |
| DONE-07 | Админ: вкладка «Нужно видео» | `GET /api/admin/feed-events?needsVideo=true` + UI. |
| DONE-08 | Админ: approve без лишнего refetch ленты | Тихий `fetchData`, `onRefreshMarkets` не на approve. |
| DONE-09 | BL-001 Webhook двойной зачёт | `updateMany` + транзакция: только один переход в `finished` + кредит. |
| DONE-10 | BL-010/011 Webhook | Сверка `price_amount` / `actually_paid` с суммой платежа; промежуточные статусы из allowlist. |
| DONE-11 | BL-002 Withdrawals | `updateMany` с `balance >= totalDeducted` в транзакции. |
| DONE-12 | BL-003 Mock платежи | В `production` без `ALLOW_MOCK_PAYMENTS=true` — 503; удаление записи Payment. |
| DONE-13 | BL-013 Create payment | При ошибке NOWPayments / нет URL — удаление `Payment`. |
| DONE-14 | BL-004/005 Poly bets | Атомарное списание `updateMany`; refund при падении `bet.create`; `numAmount` валидация. |
| DONE-15 | Internal bets | Декремент через `balance >= amount` в одной `$transaction` с bet + market. |
| DONE-16 | BL-006 Google hijack | 409 если аккаунт `provider: email`. |
| DONE-17 | BL-007 Admin emails | Только `ADMIN_EMAILS` в env (через запятую), без хардкода. |
| DONE-18 | BL-008 Client payment_url | Проверка `https` + домен `nowpayments.io`; `res.ok` + тосты. |
| DONE-19 | BL-014 Admin withdrawal | Только `status === "completed"` или `"rejected"`. |
| DONE-20 | BL-020 Admin balance | Запрет отрицательного increment ниже нуля. |
| DONE-21 | BL-021 Rate limit | `express-rate-limit` на register/login/google + create payment. |
| DONE-22 | BL-022 Register enum | Сообщение «Registration could not be completed». |
| DONE-23 | BL-024 Optional auth | Битый Bearer на публичных маршрутах → аноним, не 401. |
| DONE-24 | BL-025 Global errors | В prod клиенту только «Internal Server Error». |
| DONE-25 | BL-026 Poly public detail | `GET /api/polymarket/markets/:id` учитывает скрытые события. |
| DONE-26 | BL-027 Poly status | `GET /api/polymarket/status` только ADMIN. |
| DONE-27 | BL-028 Proxy log | В лог не попадает полный URL прокси. |
| DONE-28 | BL-045 JWT | `algorithm: HS256` / `algorithms: ['HS256']`. |
| DONE-29 | BL-047 Comments | Длина комментария до 4000, не пустой. |
| DONE-30 | BL-049 Health | В prod без деталей ошибки БД. |
| DONE-31 | Клиент: verify / History / Saved | Гонка verify по seq; нет вечного loading без `userId`. |
| DONE-32 | `GET /api/users/rankings` | Маршрут перенесён **выше** `GET /api/users/:id`, иначе Express матчил `id=rankings` и ломал лидерборд. |
| DONE-33 | Пакет BL-060…082 (сервер + клиент) | Webhook: сверка `pay_currency`/`price_currency` с `payment.currency` → иначе `currency_mismatch`. `POST /api/bets`: строковые `marketId`/`side`, internal только **YES/NO** (регистронезависимо). `ADMIN_EMAIL_SET` один раз при старте. `orderId`: `slice` вместо `substr`. Waitlist: валидация email + `intendedAmount`, rate limit. Analytics: лимит, `eventName`≤128, metadata≤8000, валидация типов. Клиент: `hasMore` порог **100**, `RankingView` `res.ok` + abort + пустое состояние + `u._count?.bets`, комментарий без spread ответа поверх маркета, тосты grant balance/winnings, `trackEvent(event, metadata)` без ложного `userId`. |
| DONE-34 | BL-063 / BL-081 / BL-083 | **CORS:** пакет `cors`, включается если задан `CORS_ORIGINS` (список Origin или `*` для dev). **Лента:** тост при сетевой ошибке и при `!res.ok` (`feedLoadError` / `feedLoadMoreError`). **Prisma:** индексы на `Payment.userId`, `Bet` (user/market/external), `Comment.marketId`, `Withdrawal.userId`, `PricePoint.marketId`, `AnalyticsEvent`, `User`/`MarketProposal` по необходимости — после деплоя выполнить `prisma db push` или миграцию. |
| DONE-35 | BL-069 / BL-079 / BL-084 | **Poly detail:** один `canonicalPolyId` для `isPolyMarketHiddenFromFeed` и `getPolymarketMarketById`; пустой id → 400. **Даты:** `formatLocaleDate` / `formatShortMonthDay*` в `utils.ts`, карточки/история/админ/деталь/график с `language`. **Seed:** `findFirst` по `title`+`creatorId`, update или create; `pricePoint` только если ещё нет точек. |
| DONE-36 | Структура + BL-075 (частично) | Монолит `App.tsx` разнесён по `src/views/`, `src/components/*`, `src/types`, `src/lib/api.ts`, `src/constants/categories.tsx`. **i18n:** названия категорий ленты, лейбл «Категории», тексты загрузки/конца ленты, роли в профиле, пустое «Сохранённые», тренд на карточке, сайдбар-теглайн, «Создать событие», подсказки пополнения, демо-тосты, шаблон шаринга. См. `src/README.md`. |
| DONE-38 | Аудит «в прод» | **Rate limit:** `GET /api/markets`, публичные `GET /api/polymarket/*` (markets, tags, market/:id, orderbook), `GET /api/health`. **Prisma:** `P2002`→409, `P2025`→404 в register / proposals / waitlist catch. **a11y:** `role="dialog"`, `aria-modal`, `aria-labelledby` на основных модалках. **HistoryView:** `res.ok`, i18n строк ставок. Удалён корневой дубликат `App.tsx` (BL-058). Чеклист: `docs/DEPLOY.md`. |

**Важно после деплоя:** задать `ADMIN_EMAILS` в `.env` для выдачи роли ADMIN (раньше были захардкоженные адреса).

---

## Открытый беклог

Линии в `server.ts` / `App.tsx` — **ориентир**; после правок кода перепроверять поиском по маршруту/строке.

### P0 — деньги, идентичность, критичные обходы

*Большинство пунктов закрыто (см. DONE-09…18). Остаётся осознанный компромисс:*

| ID | Область | Описание |
|----|---------|----------|
| BL-005b | Bets Polymarket | Локальный баланс и CLOB по-прежнему **не одна транзакция**; при успехе на бирже и сбое приложения нужен ручной/операционный reconcile. |
| BL-018 | Bets Polymarket | Нет автосверки фактического fill с суммой списания. |

### P1 — серьёзные риски и целостность

| ID | Область | Описание |
|----|---------|----------|
| BL-010 | Webhook | Нет сверки суммы/валюты из IPN с сохранённым инвойсом — целостность начисления. |
| BL-011 | Webhook | Статусы не из allowlist — в БД могут попасть произвольные строки `payment_status`. |
| BL-012 | Webhook | `rawBody` / HMAC: если путь без `verify` buffer — риск рассинхрона с подписью (см. комментарии в коде ~1312). |
| BL-013 | Payments create | Платёж в БД до успешного ответа NOWPayments — «висящие» `waiting` без отката при сбое fetch. |
| BL-014 | Admin withdrawals | `process`: всё, что не `"rejected"`, ветка **complete** — нет строгого `status === "completed"` (~1531–1548). |
| BL-015 | Withdrawals | Слабая валидация `address` и числовых полей. |
| BL-016 | Bets internal | В `$transaction` если `market` внезапно `null`, возможен возврат с уменьшенным балансом без обновления пула (~659–719). |
| BL-017 | Bets | Полymarket: refund при ошибке ордера отдельным `update` — при падении refund пользователь без денег. |
| BL-018 | Bets | Нет сверки фактического fill с списанной суммой. |
| BL-019 | Admin resolve-bets | Цикл: часть ставок обработана, процесс упал — **частичные** выплаты без явного resume. |
| BL-020 | Admin grant balance | `increment` может увести баланс в минус (нет нижней границы). |
| BL-021 | Auth | Нет rate limit на `/api/auth/register`, `/login`, `/google` — брут/spam. |
| BL-022 | Auth | Register отдаёт «Email already registered» — **перечисление** зарегистрированных email (vs generic login error). |
| BL-023 | Auth | Email/password: нет верификации почты; слабые правила пароля. |
| BL-024 | Optional auth | `attachAuthIfPresent`: битый `Authorization` → **401** на публичных маршрутах вместо анонима (~108–121). |
| BL-025 | Errors | Глобальный handler отдаёт `err.message` клиенту в prod — утечка деталей (~1685+). |
| BL-026 | Public API | `GET /api/polymarket/markets/:id` не учитывает «скрытые из ленты» события (обход скрытия по прямой ссылке на Gamma-данные). |
| BL-027 | Polymarket status | `GET /api/polymarket/status` без auth — утечка **метаданных** (privateKey configured, URLs, chainId…). |
| BL-028 | polymarket.ts | Логирование полного `CLOB_PROXY_URL` — **утечка credentials** прокси в логах. |
| BL-029 | Client | **MarketDetail:** гонки fetch без abort / version guard — stale данные или `onClose` от старого запроса. |
| BL-030 | Client | Rankings / History / Saved: те же гонки, нет отмены. |
| BL-031 | Client | `verifyUser`: гонка медленного ответа после logout/switch — может перезаписать `setUser`. |
| BL-032 | Client | History/Saved: при отсутствии `userId` **вечный loading** (spinner не сбрасывается). |
| BL-033 | Client | AuthModal Google script: в StrictMode **двойной mount** — дублирование загрузки GSI без cleanup. |
| BL-034 | Analytics | `trackEvent` + Bearer + metadata (email в waitlist) — концентрация чувствительных данных на одном endpoint. |

### P2 — укрепление, качество, операционка

| ID | Область | Описание |
|----|---------|----------|
| BL-040 | Schema | `Float` для денег — округления; рассмотреть decimal/int cents. |
| BL-041 | Webhook / logs | Логирование полного JSON инвойса NOWPayments — PII в логах. |
| BL-042 | Payments | Нет лимитов на сумму депозита / rate limit на create — спам инвойсов. |
| BL-043 | Withdrawals reject | Fee при reject пересчитывается константами — рассинхрон если константы менялись. |
| BL-044 | CORS | Не настроен в `server.ts` — учесть при вызове API с другого origin. |
| BL-045 | JWT | Явно задать `algorithms: ['HS256']` в `jwt.verify`. |
| BL-046 | Proposals | Approve: сначала `proposal` → APPROVED, потом `market.create`; при падении create — неконсистентное состояние. |
| BL-047 | Comments | Нет лимита длины/sanitize `content`. |
| BL-048 | Waitlist / analytics | Нет auth / rate limit — спам и злоупотребление. |
| BL-049 | Health | `/api/health` может отдавать детали ошибки БД наружу. |
| BL-050 | Rankings | Публичная выдача балансов/статистики — privacy / reconnaissance. |
| BL-051 | Polymarket public | Публичные markets/tags/orderbook — поверхность для скрапинга; `error.message` в ответах. |
| BL-052 | polymarket.ts | Глобальный patch `JSON.stringify` при proxy — побочный эффект на весь процесс. |
| BL-053 | Client | XSS defense-in-depth: `img`/`video`/`avatar` с произвольными URL — зависит от CSP. |
| BL-054 | Client | JWT в localStorage — стандартный риск при XSS; `trackEvent` дублирует чтение storage. |
| BL-055 | Client | `fetchMarkets` append: dedup по closure `markets` — редкие артефакты при гонках. |
| BL-056 | Client | StrictMode dev: двойные вызовы effects (`app_load`, verify, …). |
| BL-057 | Utils | `trackEvent` metadata `any` — риск случайной утечки полей в аналитику. |
| BL-058 | ~~Repo hygiene~~ | **Исправлено** (DONE-38): корневой `App.tsx` удалён; вход только `src/App.tsx`. |

### Новые находки — прогон 2026-03-20 (субагенты + проверка маршрутов)

*Часть старых строк P1 выше **устарела** (уже в DONE-09…31); ниже только то, что актуально после текущего кода.*

| ID | S | Область | Описание |
|----|---|---------|----------|
| BL-059 | ~~P0~~ | `server.ts` | **`/api/users/rankings` vs `:id`** — исправлено (DONE-32). |
| BL-060 | ~~P1~~ | Webhook | **Исправлено** (DONE-33): при наличии `pay_currency`/`price_currency` в IPN — сверка с `payment.currency`, иначе `currency_mismatch`. |
| BL-061 | ~~P1~~ | `POST /api/bets` internal | **Исправлено** (DONE-33): только **YES/NO** (регистронезависимо), иначе 400. |
| BL-062 | ~~P1~~ | `POST /api/bets` poly | **Исправлено** (DONE-33): ранняя проверка `marketId` и `side` как непустых строк. |
| BL-063 | ~~P1~~ | CORS | **Исправлено** (DONE-34): `cors` + env `CORS_ORIGINS`; без env — поведение как раньше (same-origin). |
| BL-064 | P2 | `attachAuthIfPresent` | Битый Bearer **молча игнорируется** (аноним) — ожидание 401 у части клиентов может ломаться (продуктовое решение). |
| BL-065 | P2 | Rate limit | **Частично** (DONE-38): + лимиты на `GET /api/markets`, публичные `GET /api/polymarket/*`, `GET /api/health`; ранее waitlist/analytics. Webhook по-прежнему только подпись. |
| BL-066 | P2 | Обработчики | **Частично** (DONE-38): маппинг Prisma `P2002`/`P2025` в register, proposals create, waitlist; остальные пути — по-прежнему общий 500. |
| BL-067 | ~~P2~~ | `POST /api/waitlist` | **Исправлено** (DONE-33): формат email, `intendedAmount` число ≥0, rate limit. |
| BL-068 | ~~P2~~ | `POST /api/analytics` | **Исправлено** (DONE-33): валидация `eventName`, cap metadata, rate limit. |
| BL-069 | ~~P2~~ | `GET /api/polymarket/markets/:id` | **Исправлено** (DONE-35): одна каноническая форма `poly_*` для проверки скрытия и загрузки Gamma; пустой id — 400. |
| BL-070 | ~~P2~~ | `isAdminEmail` | **Исправлено** (DONE-33): `ADMIN_EMAIL_SET` при старте процесса. |
| BL-071 | ~~P2~~ | `server.ts` | **Исправлено** (DONE-33): `slice` вместо `substr` в `orderId`. |
| BL-072 | ~~P1~~ | `RankingView` | **Исправлено** (DONE-33): `u._count?.bets`. |
| BL-073 | ~~P1~~ | `fetchMarkets` | **Исправлено** (DONE-33): `hasMore` при `limit=100` — порог **100**. |
| BL-074 | ~~P1~~ | `MarketDetail` | **Исправлено** (DONE-33): после комментария без spread тела ответа на корень маркета. |
| BL-075 | P2 | `App.tsx` i18n | **Частично** (DONE-36 + 38): + строки истории ставок (`betRow*`, `polymarketBetTitle`). Остаётся: AuthModal, MarketDetail (статы/плейсхолдеры), Wallet/Withdraw, часть админки. |
| BL-076 | ~~P2~~ | Admin modal | **Исправлено** (DONE-33): тосты `grantBalanceSuccess` / `grantWinningsSuccess`. |
| BL-077 | ~~P2~~ | `RankingView` | **Исправлено** (DONE-33): `res.ok`, флаг отмены при unmount. |
| BL-078 | P2 | a11y | **Частично** (DONE-38): основные модалки — `role="dialog"`, `aria-modal`, `aria-labelledby`. Остаётся: focus trap, Escape, `aria-label` на иконках; `alt=""` на лидерборде — DONE-33. |
| BL-079 | ~~P2~~ | Даты | **Исправлено** (DONE-35): локаль `en-US` / `ru-RU` через хелперы в `utils.ts` и `language` из стора. |
| BL-080 | ~~P2~~ | `RankingView` | **Исправлено** (DONE-33): текст пустого состояния `leaderboardEmpty`. |
| BL-081 | ~~P2~~ | `fetchMarkets` | **Исправлено** (DONE-34): тост при catch и при `!res.ok` (первая загрузка / подгрузка). |
| BL-082 | ~~P1~~ | `trackEvent` (`utils.ts`) | **Исправлено** (DONE-33): сигнатура `(eventName, metadata?)`, комментарий про сессию на сервере. |
| BL-083 | ~~P2~~ | `schema.prisma` | **Исправлено** (DONE-34): индексы на перечисленные FK/поля; применить схему к БД (`db push` / migrate). |
| BL-084 | ~~P2~~ | `prisma/seed.ts` | **Исправлено** (DONE-35): идемпотентность по `title` + `creatorId`; история цен только при отсутствии точек. |
| BL-085 | P1 | Schema/utils | `Float` для денег + JWT в `localStorage` + PII в analytics metadata — см. BL-040/054/034 (зафиксировано повторно). |

---

## Как вести цикл «аудит → фиксы»

1. Взять **P0** по одному ID, исправить, прогнать тесты/ручную проверку.
2. Пометить в этом файле: `BL-0xx` → **DONE** (дата + короткая ссылка на PR/коммит).
3. Повторить для P1, затем P2 по необходимости.

При новом аудите добавлять строки в таблицы с новыми ID (**BL-086+**), не перезаписывать историю DONE.

---

## Источники проходов

- Explore: payments / webhook / withdrawals (subagent 2026-03-19).
- Explore: bets, transactions, balance mutators (subagent 2026-03-19).
- Explore: auth, JWT, Google, rate limits (subagent 2026-03-19).
- Explore: client App, main, vite, utils (subagent 2026-03-19).
- Explore: polymarket.ts, `/api/polymarket/*` (subagent 2026-03-19).
- Ручная консолидация с предыдущими сессиями (скрытые рынки, админ UI, refill).
- **2026-03-20:** explore `server.ts` (маршруты, bets, webhook), explore `src/App.tsx`, explore schema/seed/utils/store; ручная проверка порядка `app.get` для `/api/users/rankings`.
