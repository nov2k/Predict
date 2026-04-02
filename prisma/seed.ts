import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // Create a system user if not exists
  const systemUser = await prisma.user.upsert({
    where: { handle: 'system' },
    update: {},
    create: {
      handle: 'system',
      email: 'system@predict.io',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=system',
      balance: 1000000,
    },
  });

  const markets = [
    {
      title: 'Will Bitcoin hit $100,000 before July 2026?',
      description: 'This market resolves to YES if the price of Bitcoin (BTC) reaches or exceeds $100,000 USD at any point before July 1, 2026, according to CoinGecko data.',
      category: 'crypto',
      imageUrl: 'https://picsum.photos/seed/bitcoin/1200/1600',
      yesPercent: 65,
      noPercent: 35,
      totalPool: 1250000,
      bettorsCount: 452,
      expiresAt: new Date('2026-07-01'),
      creatorId: systemUser.id,
    },
    {
      title: 'Will SpaceX land humans on Mars by 2030?',
      description: 'Resolves to YES if SpaceX successfully lands at least one human on the surface of Mars and they survive for at least 24 hours before January 1, 2031.',
      category: 'tech',
      imageUrl: 'https://picsum.photos/seed/mars/1200/1600',
      yesPercent: 12,
      noPercent: 88,
      totalPool: 850000,
      bettorsCount: 1205,
      expiresAt: new Date('2030-12-31'),
      creatorId: systemUser.id,
    },
    {
      title: 'Will GTA VI be delayed to 2026?',
      description: 'Resolves to YES if Rockstar Games officially announces that the release date for Grand Theft Auto VI has been moved to 2026 or later.',
      category: 'tech',
      imageUrl: 'https://picsum.photos/seed/gtavi/1200/1600',
      yesPercent: 42,
      noPercent: 58,
      totalPool: 2100000,
      bettorsCount: 3240,
      expiresAt: new Date('2025-12-31'),
      creatorId: systemUser.id,
    },
    {
      title: 'Will the 2026 World Cup Final be held in New Jersey?',
      description: 'Resolves to YES if FIFA officially confirms MetLife Stadium in East Rutherford, New Jersey as the venue for the 2026 World Cup Final.',
      category: 'sports',
      imageUrl: 'https://picsum.photos/seed/soccer/1200/1600',
      yesPercent: 85,
      noPercent: 15,
      totalPool: 540000,
      bettorsCount: 890,
      expiresAt: new Date('2026-06-01'),
      creatorId: systemUser.id,
    },
    {
      title: 'Will AI surpass human intelligence in creative writing by 2027?',
      description: 'Resolves to YES if a major literary prize (like the Pulitzer or Booker) is awarded to a work primarily authored by an AI, or if a double-blind study shows AI writing is indistinguishable from top human authors.',
      category: 'tech',
      imageUrl: 'https://picsum.photos/seed/ai/1200/1600',
      yesPercent: 28,
      noPercent: 72,
      totalPool: 1100000,
      bettorsCount: 1560,
      expiresAt: new Date('2027-01-01'),
      creatorId: systemUser.id,
    }
  ];

  for (const marketData of markets) {
    const videoUrl =
      marketData.category === 'crypto' || marketData.category === 'tech'
        ? marketData.category === 'crypto'
          ? 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-bitcoin-3108-large.mp4'
          : 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-at-the-beach-40251-large.mp4'
        : null;

    const existing = await prisma.market.findFirst({
      where: { title: marketData.title, creatorId: systemUser.id },
    });

    const market = existing
      ? await prisma.market.update({
          where: { id: existing.id },
          data: { ...marketData, videoUrl },
        })
      : await prisma.market.create({
          data: { ...marketData, videoUrl },
        });

    const priceCount = await prisma.pricePoint.count({ where: { marketId: market.id } });
    if (priceCount === 0) {
      const baseValue = market.yesPercent;
      for (let i = 0; i < 6; i++) {
        await prisma.pricePoint.create({
          data: {
            marketId: market.id,
            value: baseValue + (Math.random() * 10 - 5),
            createdAt: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
