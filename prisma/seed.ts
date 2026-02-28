import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = ['Sports', 'Crypto', 'Politics', 'Conspiracy', 'Pop Culture', 'Tech'];
const images = [
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=1000', // Crypto
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000', // Tech
  'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=1000', // Politics
  'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&q=80&w=1000', // Sports
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=1000', // Pop Culture
];

async function main() {
  console.log('Seeding database...');

  // Create Users
  const creators = await Promise.all(
    ['Vitalik', 'Elon', 'Zuck', 'Satoshi', 'Naval'].map(async (handle) => {
      return prisma.user.upsert({
        where: { handle },
        update: {},
        create: {
          handle,
          email: `${handle.toLowerCase()}@example.com`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
          balance: 10000,
        },
      });
    })
  );

  // Create Markets
  const marketData = [
    { title: 'Will Bitcoin hit $100k by end of 2026?', category: 'Crypto' },
    { title: 'Will SpaceX land humans on Mars by 2028?', category: 'Tech' },
    { title: 'Will the next US election be decided by < 1%?', category: 'Politics' },
    { title: 'Will AI replace > 20% of coding jobs by 2027?', category: 'Tech' },
    { title: 'Will GTA VI sell 100M copies in its first year?', category: 'Pop Culture' },
    { title: 'Will a decentralized social network surpass X in users?', category: 'Tech' },
    { title: 'Will the Lakers win the 2026 NBA Championship?', category: 'Sports' },
    { title: 'Will Ethereum flip Bitcoin in market cap?', category: 'Crypto' },
    { title: 'Will a major city implement UBI by 2027?', category: 'Politics' },
    { title: 'Will we find evidence of alien life by 2030?', category: 'Conspiracy' },
  ];

  for (let i = 0; i < 30; i++) {
    const data = marketData[i % marketData.length];
    const creator = creators[i % creators.length];
    
    await prisma.market.create({
      data: {
        title: `${data.title} #${i + 1}`,
        description: `This is a prediction market for ${data.title}. Predict the outcome and win demo credits!`,
        category: data.category,
        imageUrl: images[i % images.length],
        yesPercent: 40 + Math.random() * 20,
        noPercent: 40 + Math.random() * 20,
        totalPool: 1000 + Math.random() * 50000,
        bettorsCount: Math.floor(Math.random() * 500),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * (30 + Math.random() * 100)),
        creatorId: creator.id,
      },
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
