import express from 'express';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function isSchoolCodeQuery(message: string) {
  return /\bschool\s*code\b/i.test(message);
}

// AI Assistant prompt
const SYSTEM_PROMPT = `You are an AI assistant helping users fill out the Kerala HSCAP Appendix-8 admission form (2025 prospectus).

Your role:
1. Explain form fields clearly (any step)
2. Explain eligibility criteria
3. Explain required documents
4. Help users understand form requirements
5. Answer questions about the admission process
6. Answer any question the user has about the form, any step, or the overall process

IMPORTANT RULES:
- Users may ask about ANY step or any part of the form—answer questions about whichever step or topic they ask about
- You have full knowledge of Appendix-8 form structure and Kerala HSCAP rules
- If the user's saved form data is provided in context, you may use it to give relevant answers; otherwise answer from general knowledge of the form
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

Always be helpful and answer whatever the user asks about the form or admission process.`;

// Chat with AI
router.post('/chat', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, currentStep } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Get user's saved form data (optional context for any step they ask about)
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
      include: { stepData: true }
    });

    let contextData = '';
    if (application?.stepData) {
      const stepData = application.stepData;
      contextData = `User's saved form data (for reference when relevant):\n${JSON.stringify(stepData, null, 2)}`;
      if (currentStep) {
        contextData = `User is currently on step ${currentStep}.\n${contextData}`;
      }
    }

    const schoolStyleInstruction = isSchoolCodeQuery(message)
      ? `\n\nAnswer formatting request:\n- Reply in the same style as a helpful ChatGPT answer.\n- Use headings like:\n  - \"Here are the school codes for schools in <place>, <district>, Kerala:\"\n  - \"Primary & Lower Primary Schools\"\n  - \"Other Schools\"\n  - \"High School / Higher Secondary\"\n- Use web search results when available and include sources.\n- If you are not fully sure about a specific code, clearly label it as \"best-effort\" and ask the user to verify from the official HSCAP/education department school list.\n`
      : '';

    const userPrompt = `${message}${schoolStyleInstruction}\n\n${contextData ? `\nContext:\n${contextData}` : ''}`;

    const input = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    const useWebSearch = isSchoolCodeQuery(message);
    const webModel = process.env.OPENAI_WEB_MODEL || 'gpt-4.1';
    const defaultModel = process.env.OPENAI_MODEL || 'gpt-5-mini';

    let aiResponse = '';
    try {
      if (useWebSearch) {
        const r = await openai.responses.create({
          model: webModel,
          tools: [{ type: 'web_search_preview' }],
          input,
          temperature: 0.3,
          max_output_tokens: 500,
        });
        aiResponse =
          (r as any).output_text ||
          'I apologize, but I could not generate a response.';
      } else {
        const r = await openai.responses.create({
          model: defaultModel,
          input,
          temperature: 0.7,
          max_output_tokens: 500,
        });
        aiResponse =
          (r as any).output_text ||
          'I apologize, but I could not generate a response.';
      }
    } catch (e: any) {
      // Fallback if web_search is not enabled/allowed for this account/model.
      const errMsg = e?.message || String(e);
      console.error('AI error (responses/web_search):', errMsg);
      const r = await openai.responses.create({
        model: defaultModel,
        input,
        temperature: 0.7,
        max_output_tokens: 500,
      });
      aiResponse =
        (r as any).output_text ||
        'I apologize, but I could not generate a response.';
    }

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
