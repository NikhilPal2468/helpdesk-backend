import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get published content
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, category, page = 1, limit = 20 } = req.query;

    const where: any = { published: true };
    if (type) {
      where.type = type;
    }
    if (category) {
      where.category = category;
    }

    const content = await prisma.exploreContent.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    const total = await prisma.exploreContent.count({ where });

    res.json({
      content,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single content
router.get('/:id', authenticate, async (req, res) => {
  try {
    const content = await prisma.exploreContent.findUnique({
      where: { id: req.params.id }
    });

    if (!content || !content.published) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
