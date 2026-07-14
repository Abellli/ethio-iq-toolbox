"""
Ethio IQ Toolbox — Analytics & AI microservice (Weeks 8-11).

Runs separately from the Core API (NestJS). The Core API's sentiment-scoring
worker (apps/api/src/queue/sentiment.processor.ts) calls this service for
Amharic + English open-text sentiment analysis on survey answers.

Note: cross-tabulation and other aggregation queries ended up implemented
directly against Postgres in apps/api/src/analytics (simpler — one fewer
network hop, and Postgres already has the indexes for it). This service's
job is specifically the AI-driven sentiment scoring the blueprint calls for.

Run locally:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...   # optional — falls back to a keyword
                                           # heuristic if unset, so the pipeline
                                           # still works end-to-end without a key
    uvicorn main:app --reload --port 8001
"""

import json
import os

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Ethio IQ Analytics Service")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
SENTIMENT_MODEL = os.environ.get("ANTHROPIC_SENTIMENT_MODEL", "claude-sonnet-4-6")

_anthropic_client = None
if ANTHROPIC_API_KEY:
    from anthropic import Anthropic

    _anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


class SentimentRequest(BaseModel):
    text: str
    language_hint: str | None = None  # "am" | "en" | None (auto-detect)


class SentimentResponse(BaseModel):
    sentiment_score: float  # -1 to 1
    sentiment_label: str    # positive | neutral | negative


@app.get("/health")
def health():
    return {"status": "ok", "anthropic_configured": _anthropic_client is not None}


@app.post("/sentiment", response_model=SentimentResponse)
def score_sentiment(req: SentimentRequest):
    text = req.text.strip()
    if not text:
        return SentimentResponse(sentiment_score=0.0, sentiment_label="neutral")

    if _anthropic_client:
        try:
            return _score_with_claude(text)
        except Exception as exc:  # noqa: BLE001 — fall back rather than 500 the caller
            print(f"Claude sentiment scoring failed, falling back to heuristic: {exc}")

    return _score_with_heuristic(text)


def _score_with_claude(text: str) -> SentimentResponse:
    """
    Handles Amharic + English open-text sentiment/theming, per the blueprint's
    stack table (section 1.2, "AI sentiment"). Prompted for strict JSON so the
    caller can parse deterministically.
    """
    prompt = (
        "You are a sentiment classifier for survey responses that may be written "
        "in Amharic, English, or a mix of both. Classify the sentiment of the "
        "respondent's answer below.\n\n"
        f"Respondent's answer:\n{text}\n\n"
        "Respond with ONLY a JSON object, no other text, in exactly this shape:\n"
        '{"sentiment_score": <number between -1 and 1>, "sentiment_label": '
        '"positive" | "neutral" | "negative"}'
    )

    message = _anthropic_client.messages.create(
        model=SENTIMENT_MODEL,
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = "".join(block.text for block in message.content if block.type == "text").strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    parsed = json.loads(raw)

    score = max(-1.0, min(1.0, float(parsed["sentiment_score"])))
    label = parsed["sentiment_label"]
    if label not in ("positive", "neutral", "negative"):
        label = "neutral"
    return SentimentResponse(sentiment_score=score, sentiment_label=label)


def _score_with_heuristic(text: str) -> SentimentResponse:
    """Keyword-count fallback so the pipeline runs end-to-end without an API key."""
    lowered = text.lower()
    positive_hits = sum(w in lowered for w in ["good", "great", "love", "excellent"])
    negative_hits = sum(w in lowered for w in ["bad", "terrible", "hate", "poor"])
    score = max(-1.0, min(1.0, (positive_hits - negative_hits) * 0.5))
    label = "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"
    return SentimentResponse(sentiment_score=score, sentiment_label=label)
