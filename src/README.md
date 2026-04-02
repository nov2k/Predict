# Frontend structure

- **`App.tsx`** — корневой layout, навигация, состояние ленты, модалки-контейнеры.
- **`types/market.ts`** — `Market`, `MarketProposal`, `AppView`.
- **`lib/api.ts`** — `apiFetch`, проверка URL NOWPayments.
- **`lib/marketUtils.ts`** — хелперы Polymarket / исходов.
- **`lib/utils.ts`** — `cn`, форматирование дат/денег, `trackEvent`.
- **`constants/categories.tsx`** — категории ленты и опции категории для формы предложения (`getCategories`, `getProposalCategoryOptions`).
- **`components/ui/Button.tsx`** — `Button`, `GlassCard`.
- **`components/layout/NavAndToast.tsx`** — нижняя/боковая навигация, тост.
- **`components/market/`** — `MarketCard`, `BetModal`, `MarketDetail`.
- **`components/auth/AuthModal.tsx`**
- **`components/modals/ExtraModals.tsx`** — waitlist, подтверждение ставки, welcome, вывод, кошелёк, успех депозита.
- **`views/`** — экраны: рейтинг, история, профиль, сохранённые, создание предложения, админка.

Роутера нет: представления переключаются через `currentView` в `App` (как раньше). При необходимости позже можно подключить React Router без смены бизнес-логики.
