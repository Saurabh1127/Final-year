import React from 'react';

/**
 * PipelineInspectorModal.jsx
 *
 * Real-time End-to-End Speech Translation Diagnostics Inspector.
 * Breaks down any spoken utterance across all 4 pipeline stages:
 *   1. 🎤 Audio & VAD
 *   2. 🗣️ Speech Recognition (Faster-Whisper)
 *   3. 🌐 Machine Translation (Meta NLLB-200)
 *   4. 🔊 Speech Synthesis (TTS — Sarvam AI bulbul:v3 / Edge-TTS)
 */
export default function PipelineInspectorModal({ isOpen, onClose, data }) {
  if (!isOpen) return null;

  const diag = data?.diagnostics || {};
  const stt = diag.stt || {};
  const nmt = diag.nmt || {};
  const tts = diag.tts || {};
  const vad = diag.vad || {};
  const warnings = diag.warnings || [];
  const status = diag.status || 'healthy';
  const remedy = diag.primary_remedy || 'All pipeline stages functioned normally.';

  const isHealthy = status === 'healthy' && warnings.length === 0;
  const isWarning = status === 'warning';
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0e1017] border border-white/[0.1] shadow-2xl p-5 sm:p-7 text-slate-100 font-sans animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00d4b2]/10 border border-[#00d4b2]/25 text-[#00d4b2] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Translation Pipeline Diagnostics</h3>
              <p className="text-xs text-slate-400">
                {data?.speakerName ? `Spoken by ${data.speakerName}` : 'Latest Spoken Utterance Telemetry'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 ${
                isHealthy
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : isError
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : isError ? 'bg-rose-400' : 'bg-amber-400'}`} />
              <span>{isHealthy ? 'Pipeline Healthy' : isError ? 'Pipeline Error' : 'Inaccuracy Detected'}</span>
            </span>
            <button
              className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
              onClick={onClose}
              aria-label="Close Inspector"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Root Cause Diagnosis Banner ── */}
        <div
          className={`p-4 rounded-2xl mb-6 border ${
            isHealthy
              ? 'bg-emerald-500/[0.06] border-emerald-500/25 text-emerald-300'
              : isError
              ? 'bg-rose-500/[0.06] border-rose-500/25 text-rose-300'
              : 'bg-amber-500/[0.06] border-amber-500/25 text-amber-300'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 text-sm leading-relaxed">
            <strong className="whitespace-nowrap font-bold shrink-0">
              {isHealthy ? 'Quality Assessment:' : 'Root Cause Diagnosis:'}
            </strong>
            <span className="break-words">{remedy}</span>
          </div>

          {warnings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.08] flex flex-col gap-2">
              {warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs bg-black/20 p-2.5 rounded-xl">
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white font-mono uppercase font-bold text-[10px] shrink-0">
                    {w.stage}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-white break-words">{w.title}: {w.message}</div>
                    <div className="text-slate-300 mt-0.5 break-words"><strong>Fix:</strong> {w.suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4-Stage Breakdown Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Stage 1: Audio & VAD */}
          <div className="p-4 rounded-2xl bg-[#141722] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06] font-semibold text-sm text-[#00d4b2]">
                <span className="w-5 h-5 rounded-full bg-[#00d4b2]/20 text-[#00d4b2] text-xs flex items-center justify-center font-bold shrink-0">1</span>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <h4>Audio & VAD (Capture)</h4>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Duration:</span>
                  <span className="font-mono text-white">{vad.duration_seconds ? `${vad.duration_seconds}s` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Size:</span>
                  <span className="font-mono text-white">{vad.audio_bytes ? `${Math.round(vad.audio_bytes / 1024)} KB (WAV)` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Spoken Hint:</span>
                  <span className="font-mono text-[#00d4b2] font-semibold">{stt.hint_language ? stt.hint_language.toUpperCase() : 'AUTO'}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-white/[0.03] text-[11px]">
              {vad.duration_seconds && vad.duration_seconds < 0.7 ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Audio was cut short by silence detection</span>
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Continuous speech captured</span>
                </span>
              )}
            </div>
          </div>

          {/* Stage 2: STT (Whisper) */}
          <div className="p-4 rounded-2xl bg-[#141722] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06] font-semibold text-sm text-[#38bdf8]">
                <span className="w-5 h-5 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] text-xs flex items-center justify-center font-bold shrink-0">2</span>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h4>Speech Recognition (Whisper)</h4>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-slate-200 font-mono text-[11px] leading-relaxed break-words">
                  "{stt.original_text || data?.originalText || '(No speech detected)'}"
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Detected Lang:</span>
                  <span className="font-mono text-[#38bdf8] font-bold text-right truncate min-w-0">
                    {stt.detected_language ? stt.detected_language.toUpperCase() : (data?.sourceLanguage?.toUpperCase() || '?')}
                    {stt.language_probability ? ` (${Math.round(stt.language_probability * 100)}%)` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">STT Latency:</span>
                  <span className="font-mono text-white">{stt.asr_seconds ? `${stt.asr_seconds}s` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stage 3: NMT (NLLB) */}
          <div className="p-4 rounded-2xl bg-[#141722] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06] font-semibold text-sm text-indigo-300">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs flex items-center justify-center font-bold shrink-0">3</span>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <h4>Translation (Meta NLLB-200)</h4>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-emerald-300 font-mono text-[11px] leading-relaxed break-words">
                  "{data?.translatedText || (nmt.translations && Object.values(nmt.translations)[0]) || '(None)'}"
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Language Pair:</span>
                  <span className="font-mono text-white text-right truncate min-w-0">
                    {nmt.source_nllb_code || stt.detected_language || 'src'} → {data?.lang?.toUpperCase() || nmt.target_languages?.join(', ').toUpperCase() || 'tgt'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">NMT Latency:</span>
                  <span className="font-mono text-white">{nmt.nmt_seconds ? `${nmt.nmt_seconds}s` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stage 4: TTS */}
          <div className="p-4 rounded-2xl bg-[#141722] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06] font-semibold text-sm text-amber-300">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs flex items-center justify-center font-bold shrink-0">4</span>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <h4>Voice Synthesis (TTS)</h4>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Engine:</span>
                  <span className="font-semibold text-white text-right truncate min-w-0">{tts.engine || 'Sarvam AI / Edge-TTS'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">TTS Latency:</span>
                  <span className="font-mono text-white">{tts.tts_seconds ? `${tts.tts_seconds}s` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.03] gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Total Latency:</span>
                  <span className="font-mono text-[#00d4b2] font-bold">
                    {diag.latency?.total_seconds ? `${diag.latency.total_seconds}s` : (data?.displayLatency || 'N/A')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Diagnostic Guide / Tips ── */}
        <div className="p-4 rounded-2xl bg-[#00d4b2]/[0.04] border border-[#00d4b2]/20 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-bold text-[#00d4b2] mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <h5>Quick Diagnostic Tips:</h5>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>
              <strong className="text-slate-200">Look at Stage 2 first:</strong> If Whisper misrecognized speech, the issue is in acoustic capture/noise, not translation.
            </li>
            <li>
              <strong className="text-slate-200">Check "Detected Lang":</strong> Lock your spoken language from the top bar to eliminate phonetic transliteration.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
