<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/36a026eb-579e-4947-975f-970548a91fa8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Polymarket integration

This project now exposes backend endpoints for Polymarket market data and trading.

- Public market data (no API keys): `/api/polymarket/markets`, `/api/polymarket/markets/:id`, `/api/polymarket/orderbook/:tokenId`
- Trading (requires server-side credentials): `/api/polymarket/orders/*`

To enable trading endpoints, set these variables in `.env`:

- `POLYMARKET_PRIVATE_KEY` (wallet private key)
- `POLYMARKET_SIGNATURE_TYPE` (`0` for EOA, `1`/`2` for proxy/safe accounts)
- `POLYMARKET_FUNDER_ADDRESS` (optional for EOA, recommended for proxy accounts)
- Optional pre-generated API creds: `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_API_PASSPHRASE`

If API creds are not supplied but `POLYMARKET_PRIVATE_KEY` is present, the backend derives creds automatically on first trading call.

## Admin & payments (env)

- **`ADMIN_EMAILS`** — comma-separated emails that get role `ADMIN` on register / Google sign-up (required if you relied on the old hardcoded list).
- **`NOWPAYMENTS_API_KEY`** — omit only in dev; production without it returns 503 unless `ALLOW_MOCK_PAYMENTS=true`.
- **`MAX_DEPOSIT_AMOUNT`** — optional USD cap per invoice (default 100000).
