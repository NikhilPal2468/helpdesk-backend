import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import * as storage from '../services/storage';

const router = express.Router();
const prisma = new PrismaClient();

// Get all applications
router.get('/applications', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        user: {
          select: { id: true, phone: true, name: true }
        },
        stepData: true,
        preferences: {
          orderBy: { preferenceNumber: 'asc' }
        },
        documents: true,
        generatedPdf: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    const total = await prisma.application.count({ where });

    res.json({
      applications,
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

// Get single application
router.get('/applications/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, phone: true, name: true }
        },
        stepData: true,
        preferences: {
          orderBy: { preferenceNumber: 'asc' }
        },
        documents: true,
        generatedPdf: true,
        adminActions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify application
router.post('/applications/:id/verify', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { notes } = req.body;

    const application = await prisma.application.findUnique({
      where: { id: req.params.id }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: req.userId!
      }
    });

    await prisma.adminAction.create({
      data: {
        applicationId: req.params.id,
        adminId: req.userId!,
        action: 'VERIFIED',
        notes: notes || null
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: application.userId,
        title: 'Application Verified',
        message: 'Your application has been verified by the admin.',
        type: 'APPLICATION_VERIFIED'
      }
    });

    res.json({ success: true, application: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reject application
router.post('/applications/:id/reject', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ error: 'Rejection notes required' });
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.id }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED'
      }
    });

    await prisma.adminAction.create({
      data: {
        applicationId: req.params.id,
        adminId: req.userId!,
        action: 'REJECTED',
        notes
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: application.userId,
        title: 'Application Rejected',
        message: `Your application has been rejected. Reason: ${notes}`,
        type: 'APPLICATION_REJECTED'
      }
    });

    res.json({ success: true, application: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get PDF
router.get('/applications/:id/pdf', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { generatedPdf: true }
    });

    if (!application || !application.generatedPdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const key = application.generatedPdf.filePath;
    const exists = storage.useGcs() ? await storage.exists(key) : storage.existsSync(key);
    if (!exists) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${application.generatedPdf.fileName}"`);
    const stream = storage.getReadStream(key);
    stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
