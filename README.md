# Predict

Full-stack prediction market app with:
- React + Vite frontend
- Express + Prisma backend
- Polymarket feed/trading integration
- Admin workflows for video overlays and feed publishing

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL (or another DB URL compatible with `prisma/schema.prisma`)

## Local Setup

1. Install dependencies:
   - `npm install`
2. Create env file:
   - `cp .env.example .env`
3. Fill required values in `.env`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `APP_URL` (for payment callback URLs)
   - optional auth/payments/polymarket variables as needed
4. Sync database schema:
   - `npx prisma db push`
5. (Optional) seed demo data:
   - `npx prisma db seed`

## Run Locally

- Development (API + frontend via Vite middleware):
  - `npm run dev`
- Production build:
  - `npm run build`
- Start production server:
  - `npm run start`

## Quality Checks

- Type check:
  - `npm run lint`

## Important Endpoints

- Health: `/api/health`
- Public feed: `/api/markets`
- Polymarket public data: `/api/polymarket/markets`, `/api/polymarket/markets/:id`
- Admin feed events: `/api/admin/feed-events`
- Admin video/publish controls: `/api/admin/markets/:id/video`

## Env Notes

- `ADMIN_EMAILS`: comma-separated list of emails that should receive `ADMIN` role.
- `NOWPAYMENTS_API_KEY`: required for real invoice creation in production.
- `NOWPAYMENTS_IPN_SECRET`: required for validating payment webhooks.
- `POLYMARKET_*`: required only for trading endpoints (`/api/polymarket/orders/*`).
