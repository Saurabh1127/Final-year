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
 *
 * Pinpoints exactly which stage caused an inaccurate translation.
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
    <div className="diag-modal-backdrop" onClick={onClose}>
      <div className="diag-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div className="diag-modal-header">
          <div className="diag-title-area">
            <span className="diag-icon">🩺</span>
            <div>
              <h3>Translation Pipeline Diagnostics</h3>
              <p className="diag-subtitle">
                {data?.speakerName ? `Spoken by ${data.speakerName}` : 'Latest Spoken Utterance'}
              </p>
            </div>
          </div>
          <div className="diag-header-actions">
            <span className={`diag-status-pill ${isHealthy ? 'status-healthy' : isError ? 'status-error' : 'status-warning'}`}>
              {isHealthy ? '✅ Pipeline Healthy' : isError ? '❌ Error in Pipeline' : '⚠️ Inaccuracy Detected'}
            </span>
            <button className="diag-close-btn" onClick={onClose} aria-label="Close Inspector">✕</button>
          </div>
        </div>

        {/* ── Root Cause Diagnosis Banner ── */}
        <div className={`diag-remedy-banner ${isHealthy ? 'remedy-healthy' : isError ? 'remedy-error' : 'remedy-warning'}`}>
          <div className="remedy-header">
            <strong>{isHealthy ? '✨ Quality Assessment' : '🎯 Root Cause Diagnosis'}:</strong>
            <span>{remedy}</span>
          </div>

          {warnings.length > 0 && (
            <div className="remedy-warnings-list">
              {warnings.map((w, idx) => (
                <div key={idx} className="remedy-warning-item">
                  <span className="warning-stage-tag">{w.stage?.toUpperCase()}</span>
                  <div className="warning-content">
                    <div className="warning-title">{w.title}: {w.message}</div>
                    <div className="warning-suggestion">👉 <strong>Fix:</strong> {w.suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4-Stage Breakdown Grid ── */}
        <div className="diag-stages-grid">
          {/* ── Stage 1: Audio & VAD ── */}
          <div className="diag-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">1</span>
              <h4>🎤 Audio & VAD (Capture)</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-metric">
                <span className="metric-label">Duration:</span>
                <span className="metric-val">{vad.duration_seconds ? `${vad.duration_seconds}s` : 'N/A'}</span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Size:</span>
                <span className="metric-val">{vad.audio_bytes ? `${Math.round(vad.audio_bytes / 1024)} KB (WAV)` : 'N/A'}</span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Spoken Hint:</span>
                <span className="metric-val badge-hint">{stt.hint_language ? stt.hint_language.toUpperCase() : 'AUTO'}</span>
              </div>
              <div className="stage-note">
                {vad.duration_seconds && vad.duration_seconds < 0.7 ? (
                  <span className="text-warning">⚠️ Audio was cut short by silence detection</span>
                ) : (
                  <span className="text-success">✓ Continuous speech captured</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Stage 2: STT (Whisper) ── */}
          <div className="diag-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">2</span>
              <h4>🗣️ Speech Recognition (Whisper)</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-text-box">
                <span className="box-label">What Whisper Heard:</span>
                <div className="box-content original-spoken">
                  "{stt.original_text || data?.originalText || '(No speech detected)'}"
                </div>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Detected Lang:</span>
                <span className="metric-val badge-lang">
                  {stt.detected_language ? stt.detected_language.toUpperCase() : (data?.sourceLanguage?.toUpperCase() || '?')}
                  {stt.language_probability ? ` (${Math.round(stt.language_probability * 100)}%)` : ''}
                </span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Confidence:</span>
                <span className={`metric-val ${stt.confidence_logprob < -1.0 ? 'text-warning' : 'text-success'}`}>
                  {stt.confidence_logprob !== undefined ? `${stt.confidence_logprob} logprob` : 'Good'}
                </span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">STT Latency:</span>
                <span className="metric-val">{stt.asr_seconds ? `${stt.asr_seconds}s` : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* ── Stage 3: NMT (NLLB) ── */}
          <div className="diag-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">3</span>
              <h4>🌐 Translation (Meta NLLB-200)</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-text-box">
                <span className="box-label">Translated Text:</span>
                <div className="box-content translated-spoken">
                  "{data?.translatedText || (nmt.translations && Object.values(nmt.translations)[0]) || '(None)'}"
                </div>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Language Pair:</span>
                <span className="metric-val">
                  {nmt.source_nllb_code || stt.detected_language || 'src'} ➔ {data?.lang?.toUpperCase() || nmt.target_languages?.join(', ').toUpperCase() || 'tgt'}
                </span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">NMT Model:</span>
                <span className="metric-val">NLLB-200 1.3B INT8</span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">NMT Latency:</span>
                <span className="metric-val">{nmt.nmt_seconds ? `${nmt.nmt_seconds}s` : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* ── Stage 4: TTS (Voice Synthesis) ── */}
          <div className="diag-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">4</span>
              <h4>🔊 Voice Synthesis (TTS)</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-metric">
                <span className="metric-label">Engine Used:</span>
                <span className="metric-val badge-engine">{tts.engine || 'Sarvam AI / Edge-TTS'}</span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Audio Quality:</span>
                <span className="metric-val text-success">24,000 Hz Studio WAV</span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">TTS Latency:</span>
                <span className="metric-val">{tts.tts_seconds ? `${tts.tts_seconds}s` : 'N/A'}</span>
              </div>
              <div className="stage-metric">
                <span className="metric-label">Total Pipeline:</span>
                <span className="metric-val text-highlight">
                  {diag.latency?.total_seconds ? `${diag.latency.total_seconds}s` : (data?.displayLatency || 'N/A')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Diagnostic Guide / Tips ── */}
        <div className="diag-guide-box">
          <h5>💡 How to use this inspector to fix translation errors:</h5>
          <ul>
            <li>
              <strong>Look at Stage 2 (What Whisper Heard) first:</strong> If Whisper recognized wrong words, the error is in <em>Microphone / Speech Recognition</em>, not Translation.
            </li>
            <li>
              <strong>Check "Detected Lang":</strong> If you spoke in Hindi but Whisper detected <code>EN</code>, click <code>Speaking in: Hindi</code> in the meeting top bar to lock it.
            </li>
            <li>
              <strong>If Stage 2 is 100% correct but Stage 3 is wrong:</strong> The issue is with the <em>Translation Model (NLLB)</em> phrasing. Rephrase your sentence simply.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
