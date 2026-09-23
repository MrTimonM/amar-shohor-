"""
Phase 08 — the AI service.

Its own container, its own deploy cycle, typed contracts at the edge. The API
calls it asynchronously from a background job: if this process is down, reports
still succeed and get enriched later. That is the property worth protecting —
a citizen must never wait on a model.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field

from . import vision
from .registry import entry, model_ids

logging.basicConfig(level=logging.INFO, format='{"level":"%(levelname)s","msg":"%(message)s"}')
log = logging.getLogger("amar.ai")

app = FastAPI(
    title="Amar Shohor — intelligence service",
    version="0.1.0",
    description="Vision, severity, relevance and embeddings for civic problem reports.",
)


class AnalyseRequest(BaseModel):
    image_url: str
    reported_category: str | None = None
    description: str | None = None


class Integrity(BaseModel):
    screenshot_suspected: bool = False
    selfie_suspected: bool = False
    unusable: bool = False
    reused_image: bool = False


class AnalyseResponse(BaseModel):
    model: str
    category: str
    category_confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=1, le=5)
    relevant: bool
    embedding: list[float]
    integrity: Integrity
    took_ms: int


# --- observability ----------------------------------------------------------
# Latency, confidence distribution and override rate are the phase 08 metrics
# that make drift visible instead of guessed at. Kept in memory here; phase 14
# exports them to CloudWatch.
_latencies: deque[float] = deque(maxlen=500)
_confidences: deque[float] = deque(maxlen=500)
_disagreements: deque[int] = deque(maxlen=500)

# Phase 09's reused-image check: a rolling set of hashes this process has seen.
# The durable version lives in Atlas Vector Search alongside the report.
_seen: deque[tuple[float, ...]] = deque(maxlen=2000)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "amar-shohor-ai",
        "models": model_ids(),
        "samples": len(_latencies),
        "p50_ms": _percentile(_latencies, 50),
        "p95_ms": _percentile(_latencies, 95),
        "mean_confidence": round(sum(_confidences) / len(_confidences), 3) if _confidences else None,
        # The single most useful drift signal: how often the citizen disagrees.
        "override_rate": round(sum(_disagreements) / len(_disagreements), 3) if _disagreements else None,
    }


@app.get("/v1/models")
def models() -> dict[str, Any]:
    from .registry import REGISTRY

    return {
        "models": [
            {
                "id": e.id,
                "task": e.task,
                "trained": e.trained,
                "notes": e.notes,
                "config": e.config,
            }
            for e in REGISTRY.values()
        ]
    }


@app.post("/v1/analyse", response_model=AnalyseResponse)
async def analyse(req: AnalyseRequest) -> AnalyseResponse:
    started = time.perf_counter()

    data = await _fetch(req.image_url)
    if data is None:
        # Degrade rather than fail: the caller records that no embedding was
        # available, and dedup falls back to geography, category and time.
        return AnalyseResponse(
            model="unavailable@0.1.0",
            category=req.reported_category or "road_damage",
            category_confidence=0.0,
            severity=3,
            relevant=True,
            embedding=[],
            integrity=Integrity(),
            took_ms=int((time.perf_counter() - started) * 1000),
        )

    image = vision.load(data)

    vec = vision.embedding(image)
    category, confidence = vision.classify(image, req.reported_category)
    sev = vision.severity(image, category)
    relevant, signals = vision.relevance(image)

    reused = _is_reused(vec)
    if vec:
        _seen.append(tuple(vec))

    took_ms = int((time.perf_counter() - started) * 1000)
    _latencies.append(took_ms)
    _confidences.append(confidence)
    _disagreements.append(1 if (req.reported_category and category != req.reported_category) else 0)

    log.info(
        "analysed image category=%s confidence=%.3f severity=%d relevant=%s took_ms=%d",
        category,
        confidence,
        sev,
        relevant,
        took_ms,
    )

    return AnalyseResponse(
        model=entry("category").id,
        category=category,
        category_confidence=confidence,
        severity=sev,
        relevant=relevant,
        embedding=vec,
        integrity=Integrity(
            screenshot_suspected=signals["screenshot_suspected"],
            selfie_suspected=signals["selfie_suspected"],
            unusable=signals["unusable"],
            reused_image=reused,
        ),
        took_ms=took_ms,
    )


async def _fetch(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            res = await client.get(url)
            res.raise_for_status()
            content_type = res.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                log.warning("not an image: %s (%s)", url, content_type)
                return None
            # Bounded read: an oversized image should not exhaust the container.
            if len(res.content) > 16 * 1024 * 1024:
                log.warning("image too large: %s bytes", len(res.content))
                return None
            return res.content
    except Exception as exc:
        log.warning("could not fetch %s: %s", url, exc)
        return None


def _is_reused(vec: list[float]) -> bool:
    """Near-exact match against a photo already submitted — a recycled image."""
    if not vec:
        return False
    for prior in _seen:
        if len(prior) != len(vec):
            continue
        dot = sum(a * b for a, b in zip(prior, vec))
        if dot > 0.985:
            return True
    return False


def _percentile(values: deque[float], pct: int) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(len(ordered) * pct / 100))
    return round(ordered[index], 1)
