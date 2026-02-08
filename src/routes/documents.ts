import express from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as storage from '../services/storage';

const router = express.Router();
const prisma = new PrismaClient();

// Use memory storage so we can upload to GCS or write to local via storage service
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
  }
});

// Upload document
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Document type required' });
    }

    let application = await prisma.application.findUnique({
      where: { userId: req.userId! }
    });

    if (!application) {
      application = await prisma.application.create({
        data: { userId: req.userId!, currentStep: 12 }
      });
    }

    const ext = path.extname(req.file.originalname);
    const key = `uploads/${application.id}/${req.file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    await storage.uploadBuffer(key, req.file.buffer, req.file.mimetype);

    // Store storage key in filePath (works for both GCS and local)
    const document = await prisma.document.create({
      data: {
        applicationId: application.id,
        type: type as any,
        filePath: key,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });

    res.json({ success: true, document });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get documents
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! }
    });

    if (!application) {
      return res.json({ documents: [] });
    }

    const documents = await prisma.document.findMany({
      where: { applicationId: application.id }
    });

    res.json({ documents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete document
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { application: true }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.application.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await storage.deleteFile(document.filePath);

    await prisma.document.delete({
      where: { id: document.id }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
