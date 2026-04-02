# Predict: доступ к серверам и инфраструктура

**Внимание:** в этом документе указан **пароль SSH** к продакшен-серверу. Не публикуйте файл в открытый доступ; при утечке смените пароль на сервере. Секреты приложения (**JWT**, **ключи NOWPayments**, **приватный ключ Polymarket** и т.д.) хранятся **только** в файле `/opt/predict/.env` на сервере — их сюда не копируйте и не коммитьте.

---

## 1. Репозиторий и ветка

| Что | Значение |
|-----|----------|
| GitHub | `https://github.com/nov2k/Predict` |
| Основная ветка | `main` |
| Каталог приложения на сервере | `/opt/predict` |

```bash
git clone git@github.com:nov2k/Predict.git
cd Predict
```

---

## 2. Продакшен-сервер (`predi.club`)

| Параметр | Значение |
|----------|----------|
| Имя хоста (пример) | `srv1325863` |
| Публичный IPv4 | `72.62.37.201` |
| Пользователь SSH | `root` |
| **Пароль SSH (root)** | `9923DLEIWAN2002q-` |
| Приложение | Node.js + Express (`server.ts`), React из `dist/` |
| Внутренний порт приложения | `3025` (`0.0.0.0`) |
| PM2 | процесс **`predict`** |
| БД | PostgreSQL на `localhost`, параметры в **`/opt/predict/.env`** → `DATABASE_URL` |
| Снаружи | HTTPS через **Traefik** (Docker) → `127.0.0.1:3025` |

### 2.1. Подключение по SSH (интерактивно)

Введите пароль, когда система запросит `password`:

```bash
ssh root@72.62.37.201
# Password: 9923DLEIWAN2002q-
```

С Windows (PowerShell / CMD) — то же самое; при первом подключении ответьте `yes` на вопрос о fingerprint ключа хоста.

### 2.2. Подключение без запроса пароля (пакет `sshpass`)

Удобно для скриптов (Linux / macOS с установленным `sshpass`):

```bash
sshpass -p '9923DLEIWAN2002q-' ssh -o StrictHostKeyChecking=no root@72.62.37.201
```

Копирование каталога с сервера (пример):

```bash
sshpass -p '9923DLEIWAN2002q-' scp -r root@72.62.37.201:/opt/predict/./docs ./backup-docs
```

**Рекомендация:** после настройки доступа добавьте **SSH-ключ** в `~/.ssh/authorized_keys` на сервере и отключите вход по паролю или смените пароль.

### 2.3. Где лежат конфиги и код

| Путь | Назначение |
|------|------------|
| **`/opt/predict/.env`** | Главный конфиг приложения: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `PORT`, `GOOGLE_CLIENT_ID`, `NOWPAYMENTS_*`, `POLYMARKET_*`, прокси и т.д. **Файл не в git.** Редактировать на сервере: `nano /opt/predict/.env` |
| `/opt/predict/.env.example` | Шаблон переменных (в репозитории) |
| `/opt/predict/server.ts` | Backend Express, маршруты API |
| `/opt/predict/src/` | Исходники React |
| `/opt/predict/prisma/schema.prisma` | Схема БД Prisma |
| `/opt/predict/dist/` | Сборка фронта (`npm run build`) |
| `/opt/predict/public/uploads/` | Загруженные видео |
| `~/.pm2/` | Логи и дампы PM2 |

Формат строки БД в `.env` (пример структуры, **реальные логин и пароль только в файле на сервере**):

```text
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/predictdb?schema=public
```

Подключение к PostgreSQL **на самом сервере** (после чтения пароля из `.env`):

```bash
# на сервере
sudo -u postgres psql -d predictdb
# или с клиентом psql, подставив данные из DATABASE_URL:
# PGPASSWORD='***из .env***' psql -h localhost -U predictuser -d predictdb
```

### 2.4. Docker, Traefik, HTTPS

| Что | Где |
|-----|-----|
| Compose Traefik | `/docker/n8n/docker-compose.yml` |
| Резерв копии compose | `/docker/n8n/docker-compose.yml.bak.*` |
| Сертификаты Let's Encrypt | Docker volume `traefik_data` → в контейнере `/letsencrypt/acme.json` |
| Прокси к приложению | контейнер **`predi-proxy`**, сеть `n8n_default`, правило Traefik `Host("predi.club")` → nginx в контейнере → `host.docker.internal:3025` |

### 2.5. Обслуживание приложения

```bash
cd /opt/predict

npm ci
npm run lint
npm run build

npx prisma db push
# или: npx prisma migrate deploy

pm2 restart predict
pm2 logs predict --lines 100
```

Проверка API:

```bash
curl -sS http://127.0.0.1:3025/api/health
```

---

## 3. Другой (предыдущий) хост

Ранее приложение могло быть на другом IP с тем же путём **`/opt/predict`**, Nginx (`/etc/nginx/sites-available/`), PM2 `predict`. Учётные данные SSH к тому хосту — у администратора; в этом файле описан сервер **`72.62.37.201`**.

---

## 4. Переменные в `.env` (имена)

Смотрите актуальные значения только в **`/opt/predict/.env`** на сервере.

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | Подпись JWT |
| `APP_URL` | Базовый URL (коллбеки платежей) |
| `PORT` | Порт Node (на проде часто `3025`) |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `ADMIN_EMAILS` | Админы через запятую |
| `NOWPAYMENTS_*` | Платежи |
| `CORS_ORIGINS` | CORS при отдельном origin фронта |
| `POLYMARKET_*` | Polymarket / CLOB |
| `NODE_ENV` | Обычно `production` в процессе |

---

## 5. Структура репозитория

| Путь | Содержание |
|------|------------|
| `server.ts` | API и раздача `dist` в production |
| `src/` | React |
| `prisma/` | Схема и seed |
| `public/` | Статика |
| `docs/` | Документация, в т.ч. этот файл |

---

## 6. Безопасность

1. Не коммитить `.env` и не вставлять в чаты полные секреты из него.
2. Документ с паролем SSH хранить ограниченно; при компрометации — сменить пароль `root` и ключи в `.env`.
3. Регулярно обновлять систему и `npm audit`.

---

*Файлы: `docs/SERVER-INFRA-RU.md` (исходник), `docs/SERVER-INFRA-RU.pdf` (экспорт).*
