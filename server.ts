import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import path from "path";

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
app.get("/api/markets", async (req, res) => {
  const { userId } = req.query;
  const markets = await prisma.market.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { bets: true, comments: true, likes: true }
      },
      likes: userId ? {
        where: { userId: String(userId) }
      } : false,
      saves: userId ? {
        where: { userId: String(userId) }
      } : false
    }
  });

  const formattedMarkets = markets.map(m => ({
    ...m,
    userLiked: m.likes ? m.likes.length > 0 : false,
    userSaved: m.saves ? m.saves.length > 0 : false,
    likes: undefined,
    saves: undefined
  }));

  res.json(formattedMarkets);
});

app.get("/api/markets/:id", async (req, res) => {
  const { userId } = req.query;
  const market = await prisma.market.findUnique({
    where: { id: req.params.id },
    include: {
      comments: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      _count: {
        select: { bets: true, likes: true }
      },
      likes: userId ? {
        where: { userId: String(userId) }
      } : false,
      saves: userId ? {
        where: { userId: String(userId) }
      } : false
    }
  });

  if (!market) return res.status(404).json({ error: "Market not found" });

  const formattedMarket = {
    ...market,
    userLiked: market.likes ? market.likes.length > 0 : false,
    userSaved: market.saves ? market.saves.length > 0 : false,
    likes: undefined,
    saves: undefined
  };

  res.json(formattedMarket);
});

app.post("/api/markets/:id/comments", async (req, res) => {
  const { userId, content } = req.body;
  const marketId = req.params.id;

  try {
    const comment = await prisma.comment.create({
      data: { userId, marketId, content },
      include: { user: true }
    });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: "Failed to post comment" });
  }
});

app.post("/api/bets", async (req, res) => {
  const { userId, marketId, amount, side } = req.body;
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the bet
      const bet = await tx.bet.create({
        data: { userId, marketId, amount, side }
      });

      // 2. Update user balance
      const user = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } }
      });

      // 3. Update market stats (simplified simulation)
      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (market) {
        const totalPool = market.totalPool + amount;
        const impact = (amount / totalPool) * 10; // Simple price impact simulation
        
        let newYes = market.yesPercent;
        let newNo = market.noPercent;

        if (side === "YES") {
          newYes = Math.min(99, market.yesPercent + impact);
          newNo = 100 - newYes;
        } else {
          newNo = Math.min(99, market.noPercent + impact);
          newYes = 100 - newNo;
        }

        await tx.market.update({
          where: { id: marketId },
          data: {
            totalPool,
            yesPercent: newYes,
            noPercent: newNo,
            bettorsCount: { increment: 1 }
          }
        });
      }

      return { bet, balance: user.balance };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to place bet" });
  }
});

app.post("/api/waitlist", async (req, res) => {
  const { email, intendedAmount, userId } = req.body;
  const entry = await prisma.waitlist.create({
    data: { email, intendedAmount, userId }
  });
  res.json(entry);
});

app.post("/api/markets/:id/like", async (req, res) => {
  const { userId } = req.body;
  const marketId = req.params.id;
  
  try {
    const existing = await prisma.like.findUnique({
      where: { userId_marketId: { userId, marketId } }
    });

    if (existing) {
      await prisma.like.delete({
        where: { id: existing.id }
      });
      res.json({ liked: false });
    } else {
      await prisma.like.create({
        data: { userId, marketId }
      });
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

app.post("/api/markets/:id/save", async (req, res) => {
  const { userId } = req.body;
  const marketId = req.params.id;
  
  try {
    const existing = await prisma.save.findUnique({
      where: { userId_marketId: { userId, marketId } }
    });

    if (existing) {
      await prisma.save.delete({
        where: { id: existing.id }
      });
      res.json({ saved: false });
    } else {
      await prisma.save.create({
        data: { userId, marketId }
      });
      res.json({ saved: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle save" });
  }
});

app.post("/api/analytics", async (req, res) => {
  const { eventName, userId, metadata } = req.body;
  const event = await prisma.analyticsEvent.create({
    data: { eventName, userId, metadata: JSON.stringify(metadata) }
  });
  res.json(event);
});

app.get("/api/users/rankings", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { balance: 'desc' },
    take: 20,
    select: {
      id: true,
      handle: true,
      avatar: true,
      balance: true,
      _count: {
        select: { bets: true }
      }
    }
  });
  res.json(users);
});

app.get("/api/users/:id/bets", async (req, res) => {
  const bets = await prisma.bet.findMany({
    where: { userId: req.params.id },
    include: { market: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(bets);
});

app.get("/api/users/:id/saves", async (req, res) => {
  const saves = await prisma.save.findMany({
    where: { userId: req.params.id },
    include: { market: {
      include: {
        _count: {
          select: { bets: true, comments: true, likes: true }
        }
      }
    } },
    orderBy: { id: 'desc' }
  });
  res.json(saves.map(s => s.market));
});

// Auth Mock (Simple)
app.post("/api/auth/mock", async (req, res) => {
  const { email, handle } = req.body;
  let user = await prisma.user.findUnique({ where: { handle } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        handle,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
        balance: 10000
      }
    });
  }
  res.json(user);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
