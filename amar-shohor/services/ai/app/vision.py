"""
Phase 09 — the vision pass.

Read this file as scaffolding with honest labels, not as a trained model. Each
function produces the output shape phase 09 will produce, computed from image
statistics rather than learned weights, so the whole pipeline around it —
async queue, thresholds, review queue, dedup, override logging — is real and
testable today.

The one part that is genuinely useful as-is is `embedding`: a DCT perceptual
hash is a legitimate near-duplicate signal, and near-duplicate detection is
exactly what phase 10 asks of it.
"""

from __future__ import annotations

import io
import math

import numpy as np
from PIL import Image, ImageFilter

from .registry import entry

CATEGORIES = [
    "road_damage",
    "waterlogging",
    "garbage",
    "streetlight",
    "traffic_signal",
    "sidewalk",
    "congestion",
    "environmental",
]

EMBED_DIMS = 64
EMBED_GRID = 32


def load(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    # EXIF orientation matters: a sideways photo changes every statistic below.
    try:
        from PIL import ImageOps

        image = ImageOps.exif_transpose(image)
    except Exception:  # pragma: no cover - Pillow always ships ImageOps
        pass
    return image.convert("RGB")


def embedding(image: Image.Image) -> list[float]:
    """64-dim DCT perceptual hash, L2 normalised so cosine similarity works."""
    grey = np.asarray(image.convert("L").resize((EMBED_GRID, EMBED_GRID), Image.LANCZOS), dtype=np.float64)

    # Separable DCT-II via the orthonormal basis; keeps the dependency list to numpy.
    basis = _dct_basis(EMBED_GRID)
    coeffs = basis @ grey @ basis.T

    # Low frequencies only — the top-left 8x8 block, minus the DC term, which
    # only carries overall brightness.
    block = coeffs[:8, :8].flatten()[1 : EMBED_DIMS + 1]
    vec = np.asarray(block, dtype=np.float64)

    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        return [0.0] * EMBED_DIMS
    return [float(x) for x in (vec / norm)]


_BASIS_CACHE: dict[int, np.ndarray] = {}


def _dct_basis(n: int) -> np.ndarray:
    cached = _BASIS_CACHE.get(n)
    if cached is not None:
        return cached
    k = np.arange(n).reshape(-1, 1)
    i = np.arange(n).reshape(1, -1)
    basis = np.cos(math.pi * (2 * i + 1) * k / (2 * n))
    basis[0, :] *= 1.0 / math.sqrt(2.0)
    basis *= math.sqrt(2.0 / n)
    _BASIS_CACHE[n] = basis
    return basis


def _stats(image: Image.Image) -> dict[str, float]:
    small = image.resize((160, 160), Image.LANCZOS)
    arr = np.asarray(small, dtype=np.float64) / 255.0
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    grey = np.asarray(small.convert("L"), dtype=np.float64) / 255.0
    edges = np.asarray(small.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.float64) / 255.0

    hist, _ = np.histogram(grey, bins=32, range=(0.0, 1.0))
    hist = hist / max(1, hist.sum())
    entropy = float(-(hist[hist > 0] * np.log2(hist[hist > 0])).sum())

    # Crude skin-tone mask, used only by the relevance gate to suspect a selfie.
    skin = ((r > 0.35) & (r > g * 1.12) & (g > b * 0.95) & (r - b > 0.08)).mean()

    return {
        "brightness": float(grey.mean()),
        "contrast": float(grey.std()),
        "edge_density": float((edges > 0.22).mean()),
        "entropy": entropy,
        "saturation": float((arr.max(axis=2) - arr.min(axis=2)).mean()),
        "blue_bias": float((b - (r + g) / 2).mean()),
        "green_bias": float((g - (r + b) / 2).mean()),
        "warm_bias": float(((r + g) / 2 - b).mean()),
        "dark_area": float((grey < 0.22).mean()),
        "skin_fraction": float(skin),
        "aspect": image.width / max(1, image.height),
    }


def classify(image: Image.Image, reported: str | None) -> tuple[str, float]:
    """
    Scores each category from image statistics. Confidence is capped well below
    1.0 on purpose — nothing here has been validated against ground truth, and
    the API must never treat this as authoritative over the citizen's own choice.
    """
    s = _stats(image)
    scores = {
        # Standing water: blue cast, smooth, reflective, low edge density.
        "waterlogging": 0.9 * max(0.0, s["blue_bias"] * 6) + 0.5 * (1 - s["edge_density"]) + 0.3 * s["brightness"],
        # Broken tarmac: dark, high texture, low saturation.
        "road_damage": 0.8 * s["edge_density"] + 0.6 * (1 - s["saturation"]) + 0.5 * s["dark_area"],
        # Refuse: high entropy, mixed warm colours, very high texture.
        "garbage": 0.9 * s["entropy"] / 5 + 0.6 * s["saturation"] + 0.5 * s["edge_density"],
        # Night shot of a dead lamp: mostly dark, low entropy.
        "streetlight": 1.4 * s["dark_area"] + 0.6 * (1 - s["entropy"] / 5),
        # Signals photograph as saturated reds and ambers against sky.
        "traffic_signal": 0.9 * max(0.0, s["warm_bias"] * 5) + 0.5 * s["saturation"] + 0.3 * s["contrast"],
        # Slabs and tiles: strong regular edges, mid brightness, low saturation.
        "sidewalk": 0.7 * s["edge_density"] + 0.5 * (1 - s["saturation"]) + 0.4 * s["contrast"],
        # Vehicles packed together: very high entropy and saturation.
        "congestion": 0.8 * s["entropy"] / 5 + 0.7 * s["saturation"] + 0.4 * s["edge_density"],
        # Vegetation, smoke, open drains: green cast or washed-out haze.
        "environmental": 0.9 * max(0.0, s["green_bias"] * 6) + 0.4 * (1 - s["contrast"]),
    }

    # The citizen's own answer is prior knowledge, not noise: nudge it up so the
    # model only disagrees when the image points elsewhere clearly.
    if reported in scores:
        scores[reported] += 0.55

    total = sum(max(0.0, v) for v in scores.values()) or 1.0
    best = max(scores, key=lambda k: scores[k])
    confidence = max(0.0, scores[best]) / total

    # Cap: an untrained heuristic has no business reporting high confidence.
    ceiling = 0.62 if entry("category").trained is False else 1.0
    return best, round(min(confidence, ceiling), 3)


def severity(image: Image.Image, category: str) -> int:
    """Extent of the defect, standing in for a trained severity head."""
    s = _stats(image)
    base = 2.0
    base += 2.2 * s["edge_density"]
    base += 1.4 * s["dark_area"]
    if category in {"waterlogging", "traffic_signal", "environmental"}:
        base += 0.4  # hazard categories skew higher by default
    return int(max(1, min(5, round(base))))


def relevance(image: Image.Image) -> tuple[bool, dict[str, bool]]:
    """
    The gate that keeps selfies, screenshots and indoor shots off the public
    map. False positives here are expensive — a rejected genuine report is a
    citizen who does not come back — so the thresholds are deliberately loose
    and anything suspicious goes to human review rather than being dropped.
    """
    s = _stats(image)

    selfie = s["skin_fraction"] > 0.34
    # Screenshots have flat histograms and large uniform regions.
    screenshot = s["entropy"] < 3.1 and s["edge_density"] < 0.06
    too_dark = s["brightness"] < 0.045
    too_flat = s["contrast"] < 0.035

    signals = {
        "selfie_suspected": bool(selfie),
        "screenshot_suspected": bool(screenshot),
        "unusable": bool(too_dark or too_flat),
    }
    return (not (selfie or screenshot or too_dark or too_flat)), signals
