import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Keys allowed on ApplicationStepData (must match Prisma schema)
const STEP_DATA_KEYS = new Set([
  'examCode', 'examName', 'examNameOther', 'registerNumber', 'passingMonth', 'passingYear',
  'schoolCode', 'schoolName', 'passedBoardExam',
  'applicantName', 'aadhaarNumber', 'gender', 'category', 'categoryCode', 'ewsEligible',
  'caste', 'religion', 'dateOfBirth', 'motherName', 'fatherName', 'guardianName',
  'oec', 'linguisticMinority', 'linguisticLanguage', 'differentlyAbled', 'differentlyAbledPercentage', 'differentlyAbledTypes',
  'nativeState', 'nativeStateCode', 'nativeDistrict', 'nativeDistrictCode', 'nativeTaluk', 'nativeTalukCode',
  'nativePanchayat', 'nativePanchayatCode', 'nativeCountry', 'permanentAddress', 'permanentPinCode', 'communicationAddress', 'communicationPinCode', 'phone', 'email',
  'graceMarks', 'ncc', 'scouts', 'spc', 'defenceDependent', 'littleKitesGrade',
  'sportsStateCount', 'sportsDistrictFirst', 'sportsDistrictSecond', 'sportsDistrictThird', 'sportsDistrictParticipation',
  'kalolsavamStateCount', 'kalolsavamDistrictA', 'kalolsavamDistrictB', 'kalolsavamDistrictC', 'kalolsavamDistrictParticipation',
  'ntse', 'nmms', 'uss', 'lss',
  'scienceFairGrade', 'scienceFairCounts', 'mathsFairGrade', 'mathsFairCounts', 'itFairGrade', 'itFairCounts',
  'workExperienceGrade', 'workExperienceCounts', 'socialScienceFairCounts', 'clubs',
  'sslcAttempts', 'previousAttempts', 'subjectGrades',
  'applicantSignature', 'parentSignature', 'disclaimerAccepted',
]);

const BOOLEAN_KEYS = new Set([
  'passedBoardExam', 'ewsEligible', 'oec', 'linguisticMinority', 'differentlyAbled',
  'graceMarks', 'ncc', 'scouts', 'spc', 'defenceDependent', 'ntse', 'nmms', 'uss', 'lss', 'disclaimerAccepted',
]);

function normalizeStepData(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object') return out;
  if (body.ews !== undefined) out.ewsEligible = !!body.ews;
  const subjectGradesObj: Record<string, string> = {};
  for (const key of Object.keys(body)) {
    if (key === 'ews') continue;
    if (key.startsWith('subjectGrade_')) {
      if (body[key] != null && body[key] !== '') subjectGradesObj[key] = String(body[key]);
      continue;
    }
    if (!STEP_DATA_KEYS.has(key)) continue;
    let value = body[key];
    if (value === '' || value === null) value = null;
    else if (key === 'passingMonth' || key === 'passingYear' || key === 'sslcAttempts' ||
      key === 'sportsStateCount' || key === 'sportsDistrictFirst' || key === 'sportsDistrictSecond' ||
      key === 'sportsDistrictThird' || key === 'sportsDistrictParticipation' ||
      key === 'kalolsavamStateCount' || key === 'kalolsavamDistrictA' || key === 'kalolsavamDistrictB' ||
      key === 'kalolsavamDistrictC' || key === 'kalolsavamDistrictParticipation') {
      const n = typeof value === 'string' ? parseInt(value, 10) : value;
      value = Number.isFinite(n) ? n : null;
    } else if (key === 'dateOfBirth') {
      if (typeof value === 'string') {
        const d = new Date(value);
        value = Number.isNaN(d.getTime()) ? null : d;
      }
    } else if (key === 'clubs' && Array.isArray(value)) {
      value = JSON.stringify(value);
    } else if (key === 'previousAttempts' && Array.isArray(value)) {
      value = JSON.stringify(value);
    } else if (key === 'differentlyAbledTypes' && Array.isArray(value)) {
      // Multi-select: store as JSON; also keep legacy boolean in sync.
      const arr = value as unknown[];
      out.differentlyAbled = arr.length > 0;
      value = JSON.stringify(arr);
    } else if (key.endsWith('Counts') && typeof value === 'object' && value !== null && !(value instanceof Date)) {
      value = JSON.stringify(value);
    } else if (key === 'subjectGrades' && typeof value === 'object' && value !== null && !(value instanceof Date)) {
      value = JSON.stringify(value);
    } else if (BOOLEAN_KEYS.has(key)) {
      if (value === 'true' || value === true) value = true;
      else if (value === 'false' || value === false) value = false;
      else value = null;
    }
    out[key] = value;
  }
  if (Object.keys(subjectGradesObj).length > 0) {
    out.subjectGrades = JSON.stringify(subjectGradesObj);
  }
  // Remove undefined so Prisma doesn't receive them
  const result: Record<string, unknown> = {};
  for (const k of Object.keys(out)) {
    if (out[k] !== undefined) result[k] = out[k];
  }
  return result;
}

function hydrateStepData(stepData: any): any {
  if (!stepData) return stepData;
  const out = { ...stepData };
  if (typeof out.clubs === 'string') {
    try {
      out.clubs = JSON.parse(out.clubs);
    } catch {
      out.clubs = [];
    }
  }
  if (typeof out.previousAttempts === 'string') {
    try {
      out.previousAttempts = JSON.parse(out.previousAttempts);
    } catch {
      out.previousAttempts = [];
    }
  }
  if (typeof out.subjectGrades === 'string') {
    try {
      const grades = JSON.parse(out.subjectGrades);
      if (grades && typeof grades === 'object' && !Array.isArray(grades)) {
        for (const k of Object.keys(grades)) {
          out[k] = grades[k];
        }
      }
    } catch {
      // leave as-is
    }
  }

  // Parse JSON-backed fields for new UI
  if (typeof out.differentlyAbledTypes === 'string') {
    try {
      out.differentlyAbledTypes = JSON.parse(out.differentlyAbledTypes);
    } catch {
      out.differentlyAbledTypes = [];
    }
  }
  for (const k of [
    'scienceFairCounts',
    'mathsFairCounts',
    'itFairCounts',
    'workExperienceCounts',
    'socialScienceFairCounts',
  ]) {
    if (typeof out[k] === 'string') {
      try {
        out[k] = JSON.parse(out[k]);
      } catch {
        out[k] = null;
      }
    }
  }

  // Backward-compatible subject mapping: old key had a space in it.
  if (out['subjectGrade_SS'] == null && out['subjectGrade_Social Science'] != null) {
    out['subjectGrade_SS'] = out['subjectGrade_Social Science'];
  }
  return out;
}

// Get current application
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
      include: {
        stepData: true,
        preferences: {
          orderBy: { preferenceNumber: 'asc' }
        },
        documents: true,
        generatedPdf: true
      }
    });

    if (!application) {
      return res.json({ application: null });
    }

    const hydrated = {
      ...application,
      stepData: application.stepData ? hydrateStepData(application.stepData) : null,
    };
    res.json({ application: hydrated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save step data
router.post('/step/:stepNumber', authenticate, async (req: AuthRequest, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    const data = normalizeStepData(req.body);

    if (stepNumber < 1 || stepNumber > 13) {
      return res.status(400).json({ error: 'Invalid step number' });
    }

    // Ensure user exists (handles stale token or DB reset)
    const user = await prisma.user.findUnique({
      where: { id: req.userId! }
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found. Please log in again.' });
    }

    // Get or create application
    let application = await prisma.application.findUnique({
      where: { userId: req.userId! }
    });

    if (!application) {
      application = await prisma.application.create({
        data: {
          userId: user.id,
          currentStep: stepNumber,
          status: 'DRAFT'
        }
      });
    } else {
      application = await prisma.application.update({
        where: { id: application.id },
        data: {
          currentStep: Math.max(application.currentStep, stepNumber)
        }
      });
    }

    // Update or create step data
    const stepData = await prisma.applicationStepData.upsert({
      where: { applicationId: application.id },
      update: {
        ...data,
        updatedAt: new Date()
      },
      create: {
        applicationId: application.id,
        ...data
      }
    });

    res.json({ success: true, stepData, currentStep: application.currentStep });
  } catch (error: any) {
    console.error('POST /step/:stepNumber error', error);
    res.status(500).json({ error: error?.message || 'Failed to save step' });
  }
});

// Save preferences (Step 11)
router.post('/preferences', authenticate, async (req: AuthRequest, res) => {
  try {
    const { preferences } = req.body; // Array of { preferenceNumber, schoolCode, combinationCode }

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return res.status(400).json({ error: 'Preferences array required' });
    }

    let application = await prisma.application.findUnique({
      where: { userId: req.userId! }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Delete existing preferences
    await prisma.preference.deleteMany({
      where: { applicationId: application.id }
    });

    // Create new preferences
    await prisma.preference.createMany({
      data: preferences.map((p: any) => ({
        applicationId: application!.id,
        preferenceNumber: p.preferenceNumber,
        schoolCode: p.schoolCode,
        combinationCode: p.combinationCode
      }))
    });

    // Update current step
    await prisma.application.update({
      where: { id: application.id },
      data: { currentStep: 11 }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit application
router.post('/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
      include: {
        stepData: true,
        preferences: true,
        documents: true,
        payment: true
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Application already submitted' });
    }

    // Check if payment is completed
    if (!application.payment || application.payment.status !== 'SUCCESS') {
      return res.status(400).json({ 
        error: 'Payment required. Please complete payment before submitting.' 
      });
    }

    // Validate all required fields
    // TODO: Add comprehensive validation

    // Update status
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        status: 'PENDING',
        submittedAt: new Date(),
        currentStep: 13
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: req.userId!,
        title: 'Application Submitted',
        message: 'Your application has been submitted successfully.',
        type: 'APPLICATION_SUBMITTED'
      }
    });

    res.json({ success: true, application: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
