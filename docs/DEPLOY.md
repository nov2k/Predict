# Production deploy checklist

## Перед выкладкой

1. **Зависимости и сборка**
   ```bash
   npm ci
   npm run lint
   npm run build
   ```
2. **База данных** — применить схему Prisma (индексы и т.д.):
   ```bash
   npx prisma migrate deploy
   # или без миграций:
   npx prisma db push
   ```
   Поля `Market.skipNeedsVideoQueue`, `Market.publishedToFeed`: после обновления кода выполните `db push` / миграцию на проде.

   **Polymarket-лента:** в публичный `/api/markets` попадают только события с `publishedToFeed = true` (после загрузки видео админ жмёт «Опубликовать»). Чтобы **сохранить прежнее поведение** для уже залитых видео, один раз на проде:

   ```sql
   UPDATE "Market"
   SET "publishedToFeed" = true
   WHERE id LIKE 'poly_%'
     AND "videoUrl" IS NOT NULL
     AND btrim("videoUrl") <> '';
   ```

   Остальные `poly_*` без видео останутся черновиками только в админке.
3. **Переменные окружения** (минимум):
   - `DATABASE_URL` — PostgreSQL в проде.
   - `JWT_SECRET` — длинная случайная строка.
   - `ADMIN_EMAILS` — email админов через запятую.
   - `NODE_ENV=production` — задавать в процессе/PM2/Docker, не обязательно в `.env` для Vite.
   - Платежи: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, при необходимости `APP_URL` для callback.
   - **CORS:** если фронт на другом origin — `CORS_ORIGINS=https://your-app.com,https://www.your-app.com`.
4. **Секреты** — не коммитить `.env`; в CI/CD использовать secrets store.

## Запуск в проде

- Собрать фронт: `npm run build` → статика в `dist/`.
- Сервер: `npm run start` (или `NODE_ENV=production tsx server.ts`) должен отдавать API и `dist` (как в текущем `server.ts` с Vite preview/production static).

## Git (выкат на origin)

```bash
git add -A
git status
git commit -m "chore: audit — rate limits, prisma errors, a11y, remove duplicate App.tsx"
git push origin main
```

Дальше — по вашему пайплайну (GitHub Actions, VPS pull, Kubernetes и т.д.).

## Беклог

Полное закрытие **всех** пунктов `docs/BUG_BACKLOG.md` не требуется для релиза: остаются P0-компромиссы (Polymarket reconcile), архитектурные темы (Decimal для денег, JWT в storage) и часть P1/P2. Актуальный статус — в таблице «Новые находки» и блоке DONE в том же файле.
