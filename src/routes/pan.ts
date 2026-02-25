import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import panDocumentsRouter from './pan-documents';
import panPdfRouter from './pan-pdf';

const router = express.Router();
const prisma = new PrismaClient();

const PAN_APPLICATION_TYPES = ['NEW_PAN_INDIAN_49A', 'NEW_PAN_FOREIGN_49AA', 'PAN_CHANGE_OR_REPRINT'] as const;

const PAN_APPLICANT_CATEGORIES = [
  'INDIVIDUAL',
  'ASSOCIATION_OF_PERSONS',
  'BODY_OF_INDIVIDUALS',
  'COMPANY',
  'TRUST',
  'LIMITED_LIABILITY_PARTNERSHIP',
  'FIRM',
  'GOVERNMENT',
  'HINDU_UNDIVIDED_FAMILY',
  'ARTIFICIAL_JURIDICAL_PERSON',
  'LOCAL_AUTHORITY',
] as const;

const PAN_POI_TYPES = [
  'AADHAAR_CARD',
  'VOTER_ID',
  'PASSPORT',
  'DRIVING_LICENSE',
  'RATION_CARD_WITH_PHOTO',
  'GOVT_PHOTO_ID',
  "ARMS_LICENSE",
  'PENSIONER_CARD',
] as const;

const PAN_POA_TYPES = [
  'AADHAAR_CARD',
  'ELECTRICITY_BILL_3M',
  'WATER_BILL_3M',
  'BANK_STATEMENT_3M',
  'PASSPORT',
  'VOTER_ID',
  'DRIVING_LICENSE',
  'POST_OFFICE_PASSBOOK',
] as const;

const PAN_POB_TYPES = [
  'BIRTH_CERTIFICATE',
  'SSLC_CERTIFICATE',
  'PASSPORT',
  'DRIVING_LICENSE',
  'AADHAAR_CARD',
  'MATRICULATION_CERTIFICATE',
] as const;

router.use('/documents', panDocumentsRouter);
router.use('/pdf', panPdfRouter);

// GET /api/pan – get current user's PAN application
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
      include: {
        documents: true,
        generatedPdf: true,
      },
    });

    if (!panApplication) {
      return res.json({ panApplication: null });
    }

    res.json({ panApplication });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pan – create or update PAN application (save step data)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { stepNumber, data } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found. Please log in again.' });
    }

    let panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId },
    });

    const stepDataPayload = data && typeof data === 'object' ? data : {};

    // Optional server-side validation for new enum fields
    const rawAppType = (stepDataPayload as any).panApplicationType;
    if (
      rawAppType != null &&
      !PAN_APPLICATION_TYPES.includes(String(rawAppType) as (typeof PAN_APPLICATION_TYPES)[number])
    ) {
      return res.status(400).json({ error: 'Invalid PAN application type' });
    }

    const rawCategory = (stepDataPayload as any).panApplicantCategory;
    if (
      rawCategory != null &&
      !PAN_APPLICANT_CATEGORIES.includes(
        String(rawCategory) as (typeof PAN_APPLICANT_CATEGORIES)[number]
      )
    ) {
      return res.status(400).json({ error: 'Invalid PAN applicant category' });
    }

    const rawPoi = (stepDataPayload as any).proofOfIdentity;
    if (
      rawPoi != null &&
      !PAN_POI_TYPES.includes(String(rawPoi) as (typeof PAN_POI_TYPES)[number])
    ) {
      return res.status(400).json({ error: 'Invalid Proof of Identity document type' });
    }

    const rawPoa = (stepDataPayload as any).proofOfAddress;
    if (
      rawPoa != null &&
      !PAN_POA_TYPES.includes(String(rawPoa) as (typeof PAN_POA_TYPES)[number])
    ) {
      return res.status(400).json({ error: 'Invalid Proof of Address document type' });
    }

    const rawPob = (stepDataPayload as any).proofOfDob;
    if (
      rawPob != null &&
      !PAN_POB_TYPES.includes(String(rawPob) as (typeof PAN_POB_TYPES)[number])
    ) {
      return res.status(400).json({ error: 'Invalid Proof of Date of Birth document type' });
    }
    const existingStepData: Record<string, unknown> = panApplication?.stepData
      ? { ...(panApplication.stepData as Record<string, unknown>) }
      : {};

    // Merge this step's payload into existing stepData (flat keys)
    if (Object.keys(stepDataPayload).length > 0) {
      Object.assign(existingStepData, stepDataPayload);
    }

    if (!panApplication) {
      panApplication = await prisma.panApplication.create({
        data: {
          userId: user.id,
          status: 'DRAFT',
          stepData: existingStepData,
        },
        include: {
          documents: true,
          generatedPdf: true,
        },
      });
    } else {
      panApplication = await prisma.panApplication.update({
        where: { id: panApplication.id },
        data: {
          stepData: existingStepData,
          updatedAt: new Date(),
        },
        include: {
          documents: true,
          generatedPdf: true,
        },
      });
    }

    res.json({ success: true, panApplication });
  } catch (error: any) {
    console.error('POST /api/pan error', error);
    res.status(500).json({ error: error?.message || 'Failed to save PAN application' });
  }
});

// POST /api/pan/submit – mark PAN application as submitted
router.post('/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
      include: { documents: true, generatedPdf: true },
    });

    if (!panApplication) {
      return res.status(404).json({ error: 'PAN application not found' });
    }

    if (panApplication.status !== 'DRAFT') {
      return res.status(400).json({ error: 'PAN application already submitted' });
    }

    const updated = await prisma.panApplication.update({
      where: { id: panApplication.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        documents: true,
        generatedPdf: true,
      },
    });

    res.json({ success: true, panApplication: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
