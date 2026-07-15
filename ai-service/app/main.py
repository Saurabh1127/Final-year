from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import time
import json

from .schemas import SubtitleResponse, HealthResponse, LanguagesResponse
from .stt import transcribe_audio
from .translator import translate_to_multiple, SUPPORTED_LANGUAGES
from .language_detect import get_supported_languages

load_dotenv()

app = FastAPI(
    title="LinguaMeet AI Service",
    description="Speech-to-Text (Whisper Tiny) + Translation (NLLB Meta)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        service="linguameet-ai-service",
        whisper_model=os.getenv("WHISPER_MODEL", "tiny"),
        nllb_model=os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M"),
        timestamp=time.time(),
    )


@app.get("/api/languages", response_model=LanguagesResponse)
async def list_languages():
    """Return all supported languages for the UI dropdown."""
    return LanguagesResponse(languages=get_supported_languages())


@app.post("/api/process-audio", response_model=SubtitleResponse)
async def process_audio(
    audio: UploadFile = File(...),
    meeting_id: str = Form(...),
    user_id: str = Form(...),
    source_language: str = Form(None),
    target_languages: str = Form('["en"]'),
):
    """
    Full pipeline: Audio → Whisper STT → NLLB Translation → Subtitle JSON.
    
    Accepts multipart form data with an audio file and metadata.
    target_languages should be a JSON array string, e.g. '["en","fr","hi"]'
    """
    start_time = time.time()

    # Read audio bytes
    audio_bytes = await audio.read()

    # Parse target languages from JSON string
    try:
        targets = json.loads(target_languages)
    except json.JSONDecodeError:
        targets = ["en"]

    # Step 1: Whisper STT (+ language detection)
    src_lang = source_language if source_language and source_language != "auto" else None
    transcription = transcribe_audio(audio_bytes, source_language=src_lang)

    detected_lang = transcription["language"]
    text = transcription["text"]

    if not text:
        return SubtitleResponse(
            text="",
            source_language=detected_lang,
            translations={lang: "" for lang in targets},
            speaker_id=user_id,
            timestamp=time.time(),
        )

    # Step 2: NLLB Translation to all target languages
    translations = translate_to_multiple(text, detected_lang, targets)

    elapsed = time.time() - start_time
    print(f"⚡ Pipeline completed in {elapsed:.2f}s | "
          f"Lang: {detected_lang} | Text: {text[:60]}...")

    return SubtitleResponse(
        text=text,
        source_language=detected_lang,
        translations=translations,
        speaker_id=user_id,
        timestamp=time.time(),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
