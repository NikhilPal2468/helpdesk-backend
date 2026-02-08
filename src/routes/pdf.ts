import express from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as storage from '../services/storage';

const router = express.Router();
const prisma = new PrismaClient();

type ApplicationWithRelations = Awaited<ReturnType<typeof prisma.application.findUnique>> & {
  stepData: any;
  preferences: any[];
  documents: any[];
};

/** Check if a file exists (works for both GCS and local). */
async function fileExists(key: string): Promise<boolean> {
  if (storage.useGcs()) {
    return storage.exists(key);
  }
  return storage.existsSync(key);
}

/** Build PDF from application data, save to storage, upsert DB. Returns the generatedPdf record. */
async function buildAndSavePdf(application: NonNullable<ApplicationWithRelations>) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const margin = 50;
  const lineHeight = 15;

  const addText = (text: string, x: number, size: number = 10, isBold: boolean = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
    y -= size + 5;
  };

  // Header
  addText('KERALA HSCAP APPENDIX-8 FORM', margin, 16, true);
  y -= 10;

  const data = application.stepData;

  // Step 1: Qualifying Examination
  addText('1. QUALIFYING EXAMINATION', margin, 12, true);
  if (data.examCode) addText(`Exam Code: ${data.examCode}`, margin + 20);
  if (data.examName) addText(`Exam Name: ${data.examName}`, margin + 20);
  if (data.registerNumber) addText(`Register Number: ${data.registerNumber}`, margin + 20);
  if (data.passingMonth && data.passingYear) {
    addText(`Passing: ${data.passingMonth}/${data.passingYear}`, margin + 20);
  }
  if (data.schoolCode) addText(`School Code: ${data.schoolCode}`, margin + 20);
  if (data.schoolName) addText(`School Name: ${data.schoolName}`, margin + 20);
  y -= 10;

  // Step 2: Applicant Details
  addText('2. APPLICANT DETAILS', margin, 12, true);
  if (data.applicantName) addText(`Name: ${data.applicantName}`, margin + 20);
  if (data.aadhaarNumber) addText(`Aadhaar: ${data.aadhaarNumber}`, margin + 20);
  if (data.gender) addText(`Gender: ${data.gender}`, margin + 20);
  if (data.category) addText(`Category: ${data.category} (${data.categoryCode})`, margin + 20);
  if (data.dateOfBirth) {
    addText(`DOB: ${new Date(data.dateOfBirth).toLocaleDateString()}`, margin + 20);
  }
  y -= 10;

  // Preferences
  if (application.preferences.length > 0) {
    addText('SCHOOL PREFERENCES', margin, 12, true);
    application.preferences.forEach((pref, idx) => {
      addText(`${pref.preferenceNumber}. School: ${pref.schoolCode}, Combination: ${pref.combinationCode}`, margin + 20);
    });
    y -= 10;
  }

  // Add signatures if available (storage key or legacy absolute path)
  if (data.applicantSignature && await fileExists(data.applicantSignature)) {
    try {
      const signatureBytes = await storage.getBuffer(data.applicantSignature);
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      page.drawImage(signatureImage, {
        x: margin,
        y: y - 50,
        width: 100,
        height: 30,
      });
      addText('Applicant Signature', margin, 10);
      y -= 60;
    } catch (e) {
      // Skip if signature can't be embedded
    }
  }

  if (data.parentSignature && await fileExists(data.parentSignature)) {
    try {
      const signatureBytes = await storage.getBuffer(data.parentSignature);
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      page.drawImage(signatureImage, {
        x: margin + 200,
        y: y - 50,
        width: 100,
        height: 30,
      });
      addText('Parent/Guardian Signature', margin + 200, 10);
      y -= 60;
    } catch (e) {
      // Skip if signature can't be embedded
    }
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `application-${application.id}-${Date.now()}.pdf`;
  const key = `pdfs/${application.id}/${fileName}`;
  await storage.uploadBuffer(key, Buffer.from(pdfBytes), 'application/pdf');

  const generatedPdf = await prisma.generatedPDF.upsert({
    where: { applicationId: application.id },
    update: {
      filePath: key,
      fileName,
      fileSize: pdfBytes.length
    },
    create: {
      applicationId: application.id,
      filePath: key,
      fileName,
      fileSize: pdfBytes.length
    }
  });

  return generatedPdf;
}

// Generate PDF (explicit)
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
      include: {
        stepData: true,
        preferences: { orderBy: { preferenceNumber: 'asc' } },
        documents: true
      }
    });

    if (!application || !application.stepData) {
      return res.status(404).json({ error: 'Application not found or incomplete' });
    }

    const generatedPdf = await buildAndSavePdf(application);
    res.json({ success: true, pdf: generatedPdf });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get PDF (generates on demand if missing or stale)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    let application = await prisma.application.findUnique({
      where: { userId: req.userId! },
      include: {
        generatedPdf: true,
        stepData: { select: { updatedAt: true } }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const hasValidPdf =
      application.generatedPdf &&
      await fileExists(application.generatedPdf.filePath);

    const pdfGeneratedAt = application.generatedPdf?.generatedAt
      ? new Date(application.generatedPdf.generatedAt).getTime()
      : 0;
    const appUpdatedAt = Math.max(
      new Date(application.updatedAt).getTime(),
      application.stepData?.updatedAt ? new Date(application.stepData.updatedAt).getTime() : 0
    );
    const isStale = hasValidPdf && appUpdatedAt > pdfGeneratedAt;

    let pdf = application.generatedPdf;
    if (!hasValidPdf || isStale) {
      const appWithData = await prisma.application.findUnique({
        where: { userId: req.userId! },
        include: {
          stepData: true,
          preferences: { orderBy: { preferenceNumber: 'asc' } },
          documents: true
        }
      }) as ApplicationWithRelations | null;

      if (!appWithData || !appWithData.stepData) {
        return res.status(404).json({ error: 'Application not found or incomplete' });
      }

      pdf = await buildAndSavePdf(appWithData);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf!.fileName}"`);
    const stream = storage.getReadStream(pdf!.filePath);
    stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
