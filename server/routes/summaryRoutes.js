const express = require('express');
const router = express.Router({ mergeParams: true });
const axios = require('axios');
const Meeting = require('../models/Meeting');
const Transcript = require('../models/Transcript');
const authMiddleware = require('../middleware/auth');

/**
 * POST /api/meetings/:meetingId/summarize
 *
 * 1. Fetches all transcript entries for the meeting from MongoDB.
 * 2. Formats them into a speaker dialogue log.
 * 3. Calls Google Gemini 1.5 Flash API for structured AI summary.
 * 4. Saves summary back to Meeting document.
 * 5. Returns { executiveSummary, keyTopics, actionItems } to the client.
 */
router.post('/:meetingId/summarize', authMiddleware, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY environment variable is not configured.',
      });
    }

    // ── 1. Fetch all transcript entries ──────────────────────────────────────
    const transcripts = await Transcript.find({ meetingId })
      .sort({ timestamp: 1 })
      .lean();

    if (!transcripts || transcripts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No transcript entries found for this meeting.',
      });
    }

    // ── 2. Format transcript into speaker dialogue log ────────────────────────
    const dialogueLog = transcripts
      .map((entry) => {
        const translations = entry.translations || {};
        const translationText = Object.entries(translations)
          .map(([lang, text]) => `[${lang.toUpperCase()}]: "${text}"`)
          .join(' | ');
        return `${entry.speakerName}: "${entry.originalText}"${translationText ? ` → ${translationText}` : ''}`;
      })
      .join('\n');

    // ── 3. Compose structured Gemini prompt ──────────────────────────────────
    const prompt = `You are an expert meeting summarization AI. Analyze the following meeting transcript and return a JSON summary with exactly these three fields:
1. "executiveSummary": A concise 2–4 sentence paragraph capturing the overall purpose, key discussions, and outcome of the meeting.
2. "keyTopics": An array of 3–7 short strings listing the main discussion topics.
3. "actionItems": An array of clear, actionable strings describing tasks assigned or agreed upon during the meeting (who does what, if mentioned).

Return ONLY valid JSON, no markdown fences, no extra text.

--- MEETING TRANSCRIPT ---
${dialogueLog}
--- END TRANSCRIPT ---`;

    // ── 4. Call Gemini 1.5 Flash API ─────────────────────────────────────────
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

    // Extract generated text from Gemini response structure
    const rawText =
      geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let summary;
    try {
      summary = JSON.parse(rawText);
    } catch {
      // Attempt to extract JSON if wrapped in any stray text
      const match = rawText.match(/\{[\s\S]*\}/);
      summary = match ? JSON.parse(match[0]) : { executiveSummary: rawText, keyTopics: [], actionItems: [] };
    }

    const { executiveSummary = '', keyTopics = [], actionItems = [] } = summary;

    // ── 5. Persist summary to Meeting document ───────────────────────────────
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

    return res.json({
      success: true,
      data: { executiveSummary, keyTopics, actionItems },
    });
  } catch (err) {
    console.error('❌ [Summary] Gemini API error:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate meeting summary.',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});


/**
 * GET /api/meetings/:meetingId/summary
 * Retrieve cached summary already generated for a meeting.
 */
router.get('/:meetingId/summary', authMiddleware, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ roomCode: meetingId }).lean();

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    if (!meeting.summary?.generatedAt) {
      return res.status(404).json({ success: false, message: 'No summary generated yet for this meeting.' });
    }

    return res.json({ success: true, data: meeting.summary });
  } catch (err) {
    console.error('❌ [Summary] GET error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching summary.' });
  }
});

module.exports = router;
