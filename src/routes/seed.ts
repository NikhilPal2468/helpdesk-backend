import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get seed data
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { code } = req.query;

    const where: any = { type: type as any };
    if (code) {
      where.code = code;
    }

    const data = await prisma.seedData.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
