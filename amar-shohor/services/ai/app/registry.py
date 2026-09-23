"""
Phase 08 — the model registry.

Every model has a name, a semantic version and a config, and every prediction
records which entry produced it. That is what makes a bad rollout findable:
the API stores `model` on the report, so one query tells you which version
produced a run of wrong categories.

The registry is deliberately explicit about what is trained and what is not.
`trained: False` entries are honest placeholders for phase 09 — heuristics
that produce the right *shape* of output so the platform, the queue, the
thresholds and the dedup engine can all be built and tested before a labelled
Bangladeshi street-imagery dataset exists.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ModelEntry:
    name: str
    version: str
    task: str
    trained: bool
    notes: str
    config: dict[str, Any] = field(default_factory=dict)

    @property
    def id(self) -> str:
        return f"{self.name}@{self.version}"


REGISTRY: dict[str, ModelEntry] = {
    "category": ModelEntry(
        name="category-heuristic",
        version="0.1.0",
        task="image classification (8 civic problem types)",
        trained=False,
        notes=(
            "Colour, texture and edge statistics. Phase 09 replaces this with a "
            "ViT or EfficientNet fine-tuned on labelled Dhaka street imagery; "
            "the citizen's own category always wins in the meantime."
        ),
        config={"replaces_with": "timm/vit_base_patch16_224", "min_confidence": 0.35},
    ),
    "severity": ModelEntry(
        name="severity-heuristic",
        version="0.1.0",
        task="severity regression (1-5)",
        trained=False,
        notes="Edge density and dark-region area as a stand-in for defect extent.",
        config={},
    ),
    "embedding": ModelEntry(
        name="dct-perceptual",
        version="0.1.0",
        task="image embedding for deduplication",
        trained=True,
        notes=(
            "A 64-dimension DCT perceptual hash, L2 normalised. Genuinely useful "
            "for near-duplicate detection of the same physical spot, which is what "
            "phase 10 needs; phase 09 swaps it for DINOv2 or CLIP so semantically "
            "similar photos from different angles also match."
        ),
        config={"dims": 64, "grid": 32},
    ),
    "relevance": ModelEntry(
        name="relevance-gate",
        version="0.1.0",
        task="reject selfies, screenshots, indoor shots",
        trained=False,
        notes="Skin-tone fraction, histogram flatness and aspect-ratio heuristics.",
        config={},
    ),
}


def model_ids() -> list[str]:
    return [entry.id for entry in REGISTRY.values()]


def entry(key: str) -> ModelEntry:
    return REGISTRY[key]
