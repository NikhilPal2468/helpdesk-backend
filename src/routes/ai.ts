import express from 'express';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Assistant prompt
const SYSTEM_PROMPT = `You are an AI assistant helping users fill out the Kerala HSCAP Appendix-8 admission form (2025 prospectus).

Your role:
1. Explain form fields clearly
2. Explain eligibility criteria
3. Explain required documents
4. Help users understand form requirements
5. Answer questions about the admission process

IMPORTANT RULES:
- You can ONLY see the CURRENT STEP data that the user is working on
- You have full knowledge of Appendix-8 form structure and Kerala HSCAP rules
- NEVER auto-fill fields without explicit user confirmation
- Always provide accurate information based on the 2025 prospectus
- Be helpful, patient, and clear in your explanations
- Support both English and Malayalam languages

Form Structure (13 Steps):
1. Qualifying Examination
2. Applicant Details
3. Reservation & Special Categories
4. Residence & Address
5. Grace / Bonus Marks
6. Sports Participation
7. Kalolsavam
8. Scholarships
9. Co-curricular
10. SSLC Attempts & Marks
11. School & Combination Preferences
12. Document Upload
13. Declaration & Preview

Always be helpful and guide users step-by-step.`;

// Chat with AI
router.post('/chat', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, currentStep } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Get current step data
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
      include: { stepData: true }
    });

    let contextData = '';
    if (application?.stepData && currentStep) {
      // Include only relevant step data
      const stepData = application.stepData;
      contextData = `Current Step: ${currentStep}\nCurrent Form Data:\n${JSON.stringify(stepData, null, 2)}`;
    }

    const userPrompt = `${message}\n\n${contextData ? `\nContext:\n${contextData}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    res.json({
      success: true,
      response: aiResponse
    });
  } catch (error: any) {
    console.error('AI error:', error);
    res.status(500).json({ error: error.message || 'AI service error' });
  }
});

export default router;
