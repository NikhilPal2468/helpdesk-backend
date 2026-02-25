import express from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as storage from '../services/storage';

const router = express.Router();
const prisma = new PrismaClient();

const PAN_PURPOSES = ['PAN_POI', 'PAN_POA', 'PAN_DOB', 'PAN_PHOTO', 'PAN_SIGNATURE'] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
});

// POST /api/pan/documents – upload a PAN document
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const purpose = req.body.purpose as string;
    if (!purpose || !PAN_PURPOSES.includes(purpose as any)) {
      return res.status(400).json({
        error: 'Valid purpose required: PAN_POI, PAN_POA, PAN_DOB, PAN_PHOTO, PAN_SIGNATURE',
      });
    }

    let panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
    });

    if (!panApplication) {
      panApplication = await prisma.panApplication.create({
        data: {
          userId: req.userId!,
          status: 'DRAFT',
        },
      });
    }

    const ext = path.extname(req.file.originalname);
    const key = `pan-uploads/${panApplication.id}/${purpose}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await storage.uploadBuffer(key, req.file.buffer, req.file.mimetype);

    const document = await prisma.panDocument.create({
      data: {
        panApplicationId: panApplication.id,
        purpose: purpose as any,
        filePath: key,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    res.json({ success: true, document });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pan/documents – list PAN documents for current user's application
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
    });

    if (!panApplication) {
      return res.json({ documents: [] });
    }

    const documents = await prisma.panDocument.findMany({
      where: { panApplicationId: panApplication.id },
    });

    res.json({ documents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/pan/documents/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const document = await prisma.panDocument.findUnique({
      where: { id: req.params.id },
      include: { panApplication: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.panApplication.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await storage.deleteFile(document.filePath);
    await prisma.panDocument.delete({
      where: { id: document.id },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
