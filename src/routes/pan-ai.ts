import express from 'express';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an AI assistant helping users fill out the Indian PAN Card Form 49A.

Your role:
1. Explain PAN form fields clearly (all 5 steps used in this app)
2. Explain which options to choose based on user's situation
3. Explain required documents for POI, POA, DOB, Photo & Signature
4. Clarify concepts like source of income, AO code, application type and category
5. Help users avoid common mistakes when filling the form

IMPORTANT RULES:
- Always answer based on the latest PAN guidelines where possible.
- Be clear what is mandatory vs optional.
- Never invent AO codes or business/profession codes; tell the user how to look them up from official NSDL/UTIITSL lists instead.
- Never auto-fill fields without explicit user confirmation.
- Be helpful, patient, and support both English and Malayalam in your wording when you can.

App-specific structure:
Step 1: Application type & applicant category, applicant's name, father's & mother's name
Step 2: Personal details, contact details, address for communication, source of income
Step 3: Address details (residential/office)
Step 4: AO Code & documents (POI, POA, DOB proof, Aadhaar)
Step 5: Photo, signature & declaration.

When the user's saved PAN form data is provided, you may use it to give more targeted advice.`;

router.post('/chat', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, currentStep } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const panApplication = await prisma.panApplication.findUnique({
      where: { userId: req.userId! },
    });

    let contextData = '';
    if (panApplication?.stepData) {
      contextData = `User's saved PAN form data (for reference when relevant):\n${JSON.stringify(
        panApplication.stepData,
        null,
        2
      )}`;
      if (currentStep) {
        contextData = `User is currently on PAN step ${currentStep}.\n${contextData}`;
      }
    }

    const userPrompt = `${message}\n\n${contextData ? `Context:\n${contextData}` : ''}`;

    const input = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const r = await openai.responses.create({
      model,
      input,
      temperature: 0.7,
      max_output_tokens: 500,
    });

    const aiResponse = (r as any).output_text || 'I apologize, but I could not generate a response.';

    res.json({
      success: true,
      response: aiResponse,
    });
  } catch (error: any) {
    console.error('PAN AI error:', error);
    res.status(500).json({ error: error.message || 'AI service error' });
  }
});

export default router;

