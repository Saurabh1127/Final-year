import axios from 'axios';
import Meeting from '../models/Meeting.js';
import Transcript from '../models/Transcript.js';

class SummaryService {
  async generateSummary(meetingId) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      const error = new Error('GEMINI_API_KEY environment variable is not configured.');
      error.status = 500;
      throw error;
    }

    const transcripts = await Transcript.find({ meetingId })
      .sort({ timestamp: 1 })
      .lean();

    if (!transcripts || transcripts.length === 0) {
      const error = new Error('No transcript entries found for this meeting.');
      error.status = 404;
      throw error;
    }

    const dialogueLog = transcripts
      .map((entry) => {
        const translations = entry.translations || {};
        const translationText = Object.entries(translations)
          .map(([lang, text]) => `[${lang.toUpperCase()}]: "${text}"`)
          .join(' | ');
        return `${entry.speakerName}: "${entry.originalText}"${translationText ? ` → ${translationText}` : ''}`;
      })
      .join('\n');

    const prompt = `You are an expert meeting summarization AI. Analyze the following meeting transcript and return a JSON summary with exactly these three fields:
1. "executiveSummary": A concise 2–4 sentence paragraph capturing the overall purpose, key discussions, and outcome of the meeting.
2. "keyTopics": An array of 3–7 short strings listing the main discussion topics.
3. "actionItems": An array of clear, actionable strings describing tasks assigned or agreed upon during the meeting (who does what, if mentioned).

Return ONLY valid JSON, no markdown fences, no extra text.

--- MEETING TRANSCRIPT ---
${dialogueLog}
--- END TRANSCRIPT ---`;

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      },
      { timeout: 30000 }
    );

    const rawText =
      geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let summary;
    try {
      summary = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      summary = match ? JSON.parse(match[0]) : { executiveSummary: rawText, keyTopics: [], actionItems: [] };
    }

    const { executiveSummary = '', keyTopics = [], actionItems = [] } = summary;

    await Meeting.findOneAndUpdate(
      { roomCode: meetingId },
      {
        $set: {
          'summary.executiveSummary': executiveSummary,
          'summary.keyTopics': keyTopics,
          'summary.actionItems': actionItems,
          'summary.generatedAt': new Date(),
          status: 'ended',
          endedAt: new Date(),
        },
      },
      { new: true }
    );

    return { executiveSummary, keyTopics, actionItems };
  }

  async getSummary(meetingId) {
    const meeting = await Meeting.findOne({ roomCode: meetingId }).lean();

    if (!meeting) {
      const error = new Error('Meeting not found.');
      error.status = 404;
      throw error;
    }

    if (!meeting.summary?.generatedAt) {
      const error = new Error('No summary generated yet for this meeting.');
      error.status = 404;
      throw error;
    }

    return meeting.summary;
  }
}

export default new SummaryService();
