import axios from 'axios';
import mongoose from 'mongoose';
import Meeting from '../models/Meeting.js';
import Transcript from '../models/Transcript.js';

// Modern Gemini models available in Google Generative Language API
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

class SummaryService {
  /**
   * Generates meeting summary using Gemini API with multi-model cascade
   * and automatic extractive heuristic fallback.
   */
  async generateSummary(meetingId) {
    // 1. Resolve meeting by roomCode or MongoDB _id
    let meeting = await Meeting.findOne({ roomCode: meetingId });
    if (!meeting && mongoose.Types.ObjectId.isValid(meetingId)) {
      meeting = await Meeting.findById(meetingId);
    }

    const idList = [meetingId];
    if (meeting) {
      if (meeting.roomCode && !idList.includes(meeting.roomCode)) idList.push(meeting.roomCode);
      if (meeting._id && !idList.includes(meeting._id.toString())) idList.push(meeting._id.toString());
    }

    // 2. Fetch transcripts
    const transcripts = await Transcript.find({ meetingId: { $in: idList } })
      .sort({ timestamp: 1 })
      .lean();

    if (!transcripts || transcripts.length === 0) {
      const error = new Error('No transcript entries found for this meeting.');
      error.status = 404;
      throw error;
    }

    // 3. Build dialogue log (capped to avoid exceeding context or timeout)
    const MAX_ENTRIES = 200;
    const sampledTranscripts = transcripts.length > MAX_ENTRIES
      ? [
          ...transcripts.slice(0, 50),
          ...transcripts.slice(Math.floor(transcripts.length / 2) - 50, Math.floor(transcripts.length / 2) + 50),
          ...transcripts.slice(-50),
        ]
      : transcripts;

    const dialogueLog = sampledTranscripts
      .map((entry) => {
        const translations = entry.translations || {};
        const translationText = Object.entries(translations)
          .map(([lang, text]) => `[${lang.toUpperCase()}]: "${text}"`)
          .join(' | ');
        return `${entry.speakerName}: "${entry.originalText}"${translationText ? ` → ${translationText}` : ''}`;
      })
      .join('\n');

    let summary = null;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // 4. Attempt Gemini LLM Summarization if API key is present
    if (GEMINI_API_KEY) {
      const prompt = `You are an expert meeting summarization AI. Analyze the following multilingual meeting transcript and return a JSON summary with exactly these three fields:
1. "executiveSummary": A concise 2–4 sentence paragraph in English capturing the overall purpose, key discussions, and outcome of the meeting.
2. "keyTopics": An array of 3–7 short strings listing the main discussion topics in English.
3. "actionItems": An array of clear, actionable strings in English describing tasks assigned or agreed upon during the meeting (who does what, if mentioned).

Return ONLY valid JSON, no markdown fences, no extra text.

--- MEETING TRANSCRIPT ---
${dialogueLog}
--- END TRANSCRIPT ---`;

      for (const model of GEMINI_MODELS) {
        try {
          console.log(`🤖 [Summary] Attempting summarization with model: ${model}`);
          const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
              },
            },
            { timeout: 35000 }
          );

          const rawText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) {
            const cleanedText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            try {
              summary = JSON.parse(cleanedText);
            } catch {
              const match = cleanedText.match(/\{[\s\S]*\}/);
              if (match) summary = JSON.parse(match[0]);
            }
          }

          if (summary && summary.executiveSummary) {
            console.log(`✅ [Summary] Successfully generated summary using ${model}`);
            break;
          }
        } catch (err) {
          console.warn(`⚠️  [Summary] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
        }
      }
    }

    // 5. Fallback: Intelligent Extractive Summarization if LLM unavailable or failed
    if (!summary || !summary.executiveSummary) {
      console.log('ℹ️  [Summary] Using intelligent extractive fallback summarizer');
      summary = this._generateExtractiveFallback(transcripts);
    }

    const { executiveSummary = '', keyTopics = [], actionItems = [] } = summary;

    // 6. Save summary to Meeting document
    const query = meeting ? { _id: meeting._id } : { roomCode: meetingId };
    await Meeting.findOneAndUpdate(
      query,
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
    let meeting = await Meeting.findOne({ roomCode: meetingId }).lean();
    if (!meeting && mongoose.Types.ObjectId.isValid(meetingId)) {
      meeting = await Meeting.findById(meetingId).lean();
    }

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

  /**
   * Deterministic local heuristic summarizer for zero-downtime reliability
   */
  _generateExtractiveFallback(transcripts) {
    const speakers = [...new Set(transcripts.map((t) => t.speakerName || 'Participant'))];
    const totalLines = transcripts.length;

    // Identify action-oriented statements
    const actionKeywords = /\b(will|need to|must|should|task|assign|action|todo|prepare|implement|test|fix|deliver|follow up|update)\b/i;
    const actionItems = [];

    for (const entry of transcripts) {
      const text = entry.originalText?.trim();
      if (text && actionKeywords.test(text) && text.length > 15 && text.length < 150) {
        actionItems.push(`${entry.speakerName}: "${text}"`);
        if (actionItems.length >= 5) break;
      }
    }

    if (actionItems.length === 0) {
      actionItems.push('Review meeting transcript dialogue and follow up with participants as needed.');
    }

    // Extract key discussion topics based on frequency of words
    const stopWords = new Set(['the','and','that','have','for','not','with','you','this','but','his','from','they','say','her','she','will','one','all','would','there','their','what','out','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','us','hai','kya','aur','bhi','nahi','kar','raha','mein','toh','hua','tha','thi']);
    const wordCounts = {};

    for (const t of transcripts) {
      const words = (t.originalText || '').toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
      for (const w of words) {
        if (w.length > 3 && !stopWords.has(w)) {
          wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
      }
    }

    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    const keyTopics = sortedWords.length > 0
      ? sortedWords
      : ['General Discussion', 'Team Collaboration', 'Status Update'];

    const executiveSummary = `The meeting concluded with ${totalLines} spoken turn${totalLines === 1 ? '' : 's'} recorded between ${speakers.join(', ')}. Key discussions centered on ${keyTopics.slice(0, 3).join(', ')}, and next steps have been cataloged in the action items.`;

    return {
      executiveSummary,
      keyTopics,
      actionItems,
    };
  }
}

export default new SummaryService();
