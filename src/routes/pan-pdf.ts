import express from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as storage from '../services/storage';

const router = express.Router();
const prisma = new PrismaClient();

type PanApplicationWithRelations = Awaited<
  ReturnType<typeof prisma.panApplication.findUnique>
> & {
  documents: { id: string; purpose: string; filePath: string; mimeType: string }[];
};

async function fileExists(key: string): Promise<boolean> {
  if (storage.useGcs()) {
    return storage.exists(key);
  }
  return storage.existsSync(key);
}

function get(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toLocaleDateString();
  return String(v);
}

const APPLICATION_TYPE_LABELS: Record<string, string> = {
  NEW_PAN_INDIAN_49A: 'New PAN - Indian Citizen (Form 49A)',
  NEW_PAN_FOREIGN_49AA: 'New PAN - Foreign Citizen (Form 49AA)',
  PAN_CHANGE_OR_REPRINT:
    'Changes or Correction in existing PAN Data / Reprint of PAN Card (No changes in existing PAN Data)',
};

const APPLICANT_CATEGORY_LABELS: Record<string, string> = {
  INDIVIDUAL: 'INDIVIDUAL',
  ASSOCIATION_OF_PERSONS: 'ASSOCIATION OF PERSONS',
  BODY_OF_INDIVIDUALS: 'BODY OF INDIVIDUALS',
  COMPANY: 'COMPANY',
  TRUST: 'TRUST',
  LIMITED_LIABILITY_PARTNERSHIP: 'LIMITED LIABILITY PARTNERSHIP',
  FIRM: 'FIRM',
  GOVERNMENT: 'GOVERNMENT',
  HINDU_UNDIVIDED_FAMILY: 'HINDU UNDIVIDED FAMILY',
  ARTIFICIAL_JURIDICAL_PERSON: 'ARTIFICIAL JURIDICAL PERSON',
  LOCAL_AUTHORITY: 'LOCAL AUTHORITY',
};

const INCOME_SOURCE_LABELS: Record<string, string> = {
  incomeFromSalary: 'Salary',
  incomeFromHouseProperty: 'Income from House property',
  incomeFromBusinessProfession: 'Income from Business / Profession',
  incomeFromOtherSources: 'Income from Other sources',
  incomeFromCapitalGains: 'Capital Gains',
  incomeNoIncome: 'No income',
};

const POI_LABELS: Record<string, string> = {
  AADHAAR_CARD: 'Aadhaar Card',
  VOTER_ID: 'Voter ID',
  PASSPORT: 'Passport',
  DRIVING_LICENSE: 'Driving License',
  RATION_CARD_WITH_PHOTO: 'Ration Card with Photo',
  GOVT_PHOTO_ID: 'Photo ID issued by Govt',
  ARMS_LICENSE: "Arm's License",
  PENSIONER_CARD: 'Pensioner Card',
};

const POA_LABELS: Record<string, string> = {
  AADHAAR_CARD: 'Aadhaar Card',
  ELECTRICITY_BILL_3M: 'Electricity Bill (≤ 3 months old)',
  WATER_BILL_3M: 'Water Bill (≤ 3 months old)',
  BANK_STATEMENT_3M: 'Bank Statement (≤ 3 months old)',
  PASSPORT: 'Passport',
  VOTER_ID: 'Voter ID',
  DRIVING_LICENSE: 'Driving License',
  POST_OFFICE_PASSBOOK: 'Post Office Passbook',
};

const POB_LABELS: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Birth Certificate',
  SSLC_CERTIFICATE: 'SSLC/10th Certificate',
  PASSPORT: 'Passport',
  DRIVING_LICENSE: 'Driving License',
  AADHAAR_CARD: 'Aadhaar Card',
  MATRICULATION_CERTIFICATE: 'Matriculation Certificate',
};

/** Build Form 49A-style PDF from PAN application, save to storage, upsert GeneratedPanPdf. */
async function buildAndSavePanPdf(
  panApplication: NonNullable<PanApplicationWithRelations>
): Promise<{ id: string; filePath: string; fileName: string; fileSize: number }> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 820;
  const margin = 50;

  const addText = (text: string, x: number, size: number = 10, isBold: boolean = false) => {
    if (!text) return;
    const safe = text.length > 80 ? text.slice(0, 77) + '...' : text;
    page.drawText(safe, {
      x,
      y,
      size,
      font: isBold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
    y -= size + 4;
  };

  const data = (panApplication.stepData || {}) as Record<string, unknown>;

  addText('APPLICATION FOR ALLOTMENT OF PERMANENT ACCOUNT NUMBER (Form 49A)', margin, 14, true);
  y -= 8;

  const rawAppType = data.panApplicationType as string | undefined;
  const rawCategory = data.panApplicantCategory as string | undefined;
  const appTypeLabel = rawAppType ? APPLICATION_TYPE_LABELS[rawAppType] || rawAppType : '';
  const categoryLabel = rawCategory ? APPLICANT_CATEGORY_LABELS[rawCategory] || rawCategory : '';

  if (appTypeLabel) {
    addText(`Application type: ${appTypeLabel}`, margin, 10);
  }
  if (categoryLabel) {
    addText(`Applicant category: ${categoryLabel}`, margin, 10);
  }
  y -= 4;

  addText('1. APPLICANT & NAME', margin, 12, true);
  addText(`Name: ${get(data, 'lastName')} ${get(data, 'firstName')} ${get(data, 'middleName')}`.trim(), margin + 15);
  addText(`Father: ${get(data, 'fatherLastName')} ${get(data, 'fatherFirstName')} ${get(data, 'fatherMiddleName')}`.trim(), margin + 15);
  addText(`Mother: ${get(data, 'motherLastName')} ${get(data, 'motherFirstName')} ${get(data, 'motherMiddleName')}`.trim(), margin + 15);
  y -= 8;

  addText('2. PERSONAL & CONTACT', margin, 12, true);
  addText(`DOB: ${get(data, 'dateOfBirth')}`, margin + 15);
  addText(`Gender: ${get(data, 'gender')}`, margin + 15);
  addText(`Mobile: ${get(data, 'mobileCountryCode')} ${get(data, 'mobileNumber')}`, margin + 15);
  addText(`Email: ${get(data, 'email')}`, margin + 15);
  addText(`Address for communication: ${get(data, 'addressForCommunication')}`, margin + 15);
  const incomeSources: string[] = [];
  for (const key of Object.keys(INCOME_SOURCE_LABELS)) {
    if ((data as any)[key]) {
      incomeSources.push(INCOME_SOURCE_LABELS[key]);
    }
  }
  if (incomeSources.length > 0) {
    addText(`Source of Income: ${incomeSources.join(', ')}`, margin + 15);
  }
  const bpCode = get(data, 'businessProfessionCode');
  if (bpCode) {
    addText(`Business/Profession code: ${bpCode}`, margin + 15);
  }
  y -= 8;

  addText('3. ADDRESS', margin, 12, true);
  addText(`Premises: ${get(data, 'premisesVillage')}`, margin + 15);
  addText(`Road: ${get(data, 'roadStreetLane')}`, margin + 15);
  addText(`Area: ${get(data, 'areaLocalityTaluk')}`, margin + 15);
  addText(`Town/City: ${get(data, 'townCityDistrict')}`, margin + 15);
  addText(`State: ${get(data, 'state')}  Pincode: ${get(data, 'pincode')}  Country: ${get(data, 'country')}`, margin + 15);
  if (get(data, 'officePremisesVillage')) {
    addText('Office:', margin + 15);
    addText(`  ${get(data, 'officePremisesVillage')}`, margin + 20);
    addText(`  ${get(data, 'officeTownCityDistrict')} ${get(data, 'officePincode')}`, margin + 20);
  }
  y -= 8;

  addText('4. AO CODE & DOCUMENTS', margin, 12, true);
  addText(`AO Area: ${get(data, 'aoAreaCode')} Type: ${get(data, 'aoType')} Range: ${get(data, 'aoRangeCode')} No: ${get(data, 'aoNumber')}`, margin + 15);
  const poiRaw = get(data, 'proofOfIdentity');
  const poaRaw = get(data, 'proofOfAddress');
  const pobRaw = get(data, 'proofOfDob');
  const poiLabel = poiRaw ? POI_LABELS[poiRaw] || poiRaw : '';
  const poaLabel = poaRaw ? POA_LABELS[poaRaw] || poaRaw : '';
  const pobLabel = pobRaw ? POB_LABELS[pobRaw] || pobRaw : '';
  addText(`Proof of Identity: ${poiLabel}`, margin + 15);
  addText(`Proof of Address: ${poaLabel}`, margin + 15);
  addText(`Proof of DOB: ${pobLabel}`, margin + 15);
  addText(`Aadhaar: ${get(data, 'aadhaarNumber')}`, margin + 15);
  y -= 8;

  addText('5. DECLARATION', margin, 12, true);
  addText(data.declarationAccepted ? 'I hereby declare that the information given is true and correct.' : '(Not accepted)', margin + 15);
  y -= 10;

  // Optionally embed PAN photo/signature from PanDocument
  for (const doc of panApplication.documents) {
    if ((doc.purpose === 'PAN_PHOTO' || doc.purpose === 'PAN_SIGNATURE') && doc.mimeType?.startsWith('image/')) {
      try {
        if (await fileExists(doc.filePath)) {
          const buf = await storage.getBuffer(doc.filePath);
          const img = doc.mimeType === 'image/png' ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
          const w = 80;
          const h = Math.min(60, (img.height / img.width) * w);
          page.drawImage(img, { x: margin, y: y - h, width: w, height: h });
          addText(doc.purpose === 'PAN_PHOTO' ? 'Photo' : 'Signature', margin, 9);
          y -= h + 15;
        }
      } catch {
        // skip
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `pan-${panApplication.id}-${Date.now()}.pdf`;
  const key = `pan-pdfs/${panApplication.id}/${fileName}`;
  await storage.uploadBuffer(key, Buffer.from(pdfBytes), 'application/pdf');

  const generatedPdf = await prisma.generatedPanPdf.upsert({
    where: { panApplicationId: panApplication.id },
    update: { filePath: key, fileName, fileSize: pdfBytes.length },
    create: {
      panApplicationId: panApplication.id,
      filePath: key,
      fileName,
      fileSize: pdfBytes.length,
    },
  });

  return generatedPdf;
}

router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
      include: { documents: true },
    });

    if (!panApplication || !panApplication.stepData) {
      return res.status(404).json({ error: 'PAN application not found or incomplete' });
    }

    const pdf = await buildAndSavePanPdf(panApplication as PanApplicationWithRelations);
    res.json({ success: true, pdf });
  } catch (error: any) {
    console.error('PAN PDF generation error', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    let panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
      include: { generatedPdf: true, documents: true },
    });

    if (!panApplication) {
      return res.status(404).json({ error: 'PAN application not found' });
    }

    const hasValidPdf =
      panApplication.generatedPdf && (await fileExists(panApplication.generatedPdf.filePath));
    const pdfGeneratedAt = panApplication.generatedPdf?.generatedAt
      ? new Date(panApplication.generatedPdf.generatedAt).getTime()
      : 0;
    const appUpdatedAt = new Date(panApplication.updatedAt).getTime();
    const isStale = hasValidPdf && appUpdatedAt > pdfGeneratedAt;

    let pdf = panApplication.generatedPdf;
    if (!hasValidPdf || isStale) {
      pdf = await buildAndSavePanPdf(panApplication as PanApplicationWithRelations);
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
