import express from 'express';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Translate English to Malayalam (OpenAI)
router.post('/translate', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { titleEn, contentEn } = req.body;
    if (!titleEn?.trim() && !contentEn?.trim()) {
      return res.status(400).json({ error: 'At least one of titleEn or contentEn is required' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'Translation service not configured' });
    }

    const userMessage = `Translate the following to Malayalam. Return ONLY valid JSON with no other text, in this exact format: {"titleMl":"...","contentMl":"..."}
Title (English): ${titleEn || ''}
Content (English): ${contentEn || ''}

If title is empty, use "". If content is empty, use "".`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You translate English to Malayalam. Reply only with valid JSON: {"titleMl":"...","contentMl":"..."}. No markdown, no explanation.',
        },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return res.status(500).json({ error: 'Empty translation response' });
    }

    let parsed: { titleMl?: string; contentMl?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Invalid translation response format' });
    }

    res.json({
      titleMl: typeof parsed.titleMl === 'string' ? parsed.titleMl : (titleEn || ''),
      contentMl: typeof parsed.contentMl === 'string' ? parsed.contentMl : (contentEn || ''),
    });
  } catch (error: any) {
    if (error?.status === 401) {
      return res.status(503).json({ error: 'Translation API key invalid' });
    }
    res.status(500).json({ error: error?.message || 'Translation failed' });
  }
});

// Get all content
router.get('/content', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { type, published } = req.query;
    
    const where: any = {};
    if (type) {
      where.type = type;
    }
    if (published !== undefined) {
      where.published = published === 'true';
    }

    const content = await prisma.exploreContent.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create content
router.post('/content', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { type, titleEn, titleMl, contentEn, contentMl, videoUrl, category, published } = req.body;

    const content = await prisma.exploreContent.create({
      data: {
        type: type as any,
        titleEn,
        titleMl,
        contentEn,
        contentMl,
        videoUrl,
        category,
        published: published || false,
        publishedAt: published ? new Date() : null
      }
    });

    res.json({ success: true, content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update content
router.put('/content/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { titleEn, titleMl, contentEn, contentMl, videoUrl, category, published } = req.body;

    const content = await prisma.exploreContent.update({
      where: { id: req.params.id },
      data: {
        titleEn,
        titleMl,
        contentEn,
        contentMl,
        videoUrl,
        category,
        published,
        publishedAt: published ? new Date() : null
      }
    });

    res.json({ success: true, content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete content
router.delete('/content/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await prisma.exploreContent.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
