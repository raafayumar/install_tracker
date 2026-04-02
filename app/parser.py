"""
FILE: app/parser.py
Slack message parser for Install Tracker.

Parses partner blocks from daily Slack status messages, extracting:
  - partner name & pipeline type (OB / PPE)
  - stages (Annotate, Review, Protex Review) with tasks & frames
  - dataset list (CompID-SiteID pairs)
  - per-site task counts (when available in new format)

Supports both old and new Slack formats:
  Old:  "     datasets: 150-936, 320-1163"
  New:  "     150-936 (36 tasks), 320-1163 (13 tasks)"
"""

import re
from typing import List, Dict, Any


# ── Public API ───────────────────────────────────────────────────────────────

def parse_slack_message(raw_text: str) -> List[Dict[str, Any]]:
    """
    Parse a full Slack update message.

    Returns a list of dicts, one per partner block:
        {
            "partner": "Cogito_v2",
            "pipeline_type": "OB" | "PPE",
            "stages": [
                {
                    "stage_name": "Annotate",
                    "tasks": 88,
                    "frames": 2605,
                    "datasets": ["150-936", "320-1163"],
                    "dataset_tasks": {"150-936": 36, "320-1163": 13}  # if available
                },
                ...
            ]
        }
    """
    blocks = _split_blocks(raw_text)
    results: List[Dict[str, Any]] = []

    for block in blocks:
        parsed = _parse_partner_block(block)
        if parsed is not None:
            results.append(parsed)

    return results


# ── Internal helpers ─────────────────────────────────────────────────────────

_SEPARATOR_RE = re.compile(r"^-{4,}\s*$", re.MULTILINE)

# Matches partner header line — must be a single token (with optional _v2, -ppe, etc.)
_PARTNER_RE = re.compile(
    r"^([A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)*)\s*$"
)

# Matches a stage line like  "Annotate     : 88 tasks (2605 frames)"
_STAGE_RE = re.compile(
    r"^\s*(Annotate|Review|Protex\s+Review)\s*:\s*(\d+)\s+tasks?\s*\((\d+)\s+frames?\)",
    re.IGNORECASE
)

# OLD format: "     datasets: 150-936, 320-1163"
_DATASET_RE = re.compile(
    r"^\s*datasets?\s*:\s*(.+)$", re.IGNORECASE
)

# NEW format: "     150-936 (36 tasks), 320-1163 (13 tasks)"
# Matches lines with one or more "compid-siteid (N tasks)" entries
_NEW_DATASET_RE = re.compile(
    r"^\s+(\d+-\d+)\s+\(\d+\s+tasks?\)", re.IGNORECASE
)

# Extract individual "compid-siteid (N task(s))" tokens from new format
_NEW_DS_TOKEN_RE = re.compile(r"(\d+-\d+)\s+\((\d+)\s+tasks?\)")

# Individual dataset token for old format  e.g. "150-936"
_DS_TOKEN_RE = re.compile(r"(\d+-\d+)")

# Lines to skip
_SKIP_RE = re.compile(
    r"^\s*(Total tasks to annotate|Annotation task lifetime|•\s)",
    re.IGNORECASE
)


def _split_blocks(text: str) -> List[str]:
    """Split the raw message on dashed separator lines."""
    parts = _SEPARATOR_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def _determine_pipeline_type(partner: str) -> str:
    """Return 'PPE' if partner name contains '-ppe', else 'OB'."""
    if "-ppe" in partner.lower():
        return "PPE"
    return "OB"


def _parse_partner_block(block: str) -> Dict[str, Any] | None:
    """
    Try to parse a single block as a partner section.
    Returns None if the block is a Summary section or otherwise unparseable.
    """
    lines = block.splitlines()
    if not lines:
        return None

    # Skip summary / info blocks
    first_non_empty = ""
    for ln in lines:
        stripped = ln.strip()
        if stripped:
            first_non_empty = stripped
            break

    if first_non_empty.lower().startswith("summary"):
        return None
    if "is working on" in first_non_empty.lower():
        return None
    if first_non_empty.lower().startswith("to annotate"):
        return None
    if first_non_empty.lower().startswith("annotation task lifetime"):
        return None
    if first_non_empty.lower().startswith("current annotation"):
        return None
    if first_non_empty.lower().startswith("includes datasets"):
        return None

    # Detect partner name (first non-empty line)
    partner_match = _PARTNER_RE.match(first_non_empty)
    if not partner_match:
        return None

    partner = partner_match.group(1)
    pipeline_type = _determine_pipeline_type(partner)

    stages = _extract_stages(lines[1:])  # everything after partner line

    # Only return if we found at least one stage
    if not stages:
        return None

    return {
        "partner": partner,
        "pipeline_type": pipeline_type,
        "stages": stages,
    }


def _extract_stages(lines: List[str]) -> List[Dict[str, Any]]:
    """
    Walk lines and collect stage entries.
    Each stage may be followed by dataset lines in old or new format.
    """
    stages: List[Dict[str, Any]] = []
    current_stage: Dict[str, Any] | None = None

    for line in lines:
        # Skip "Total tasks to annotate", lifetime stats, bullet points
        if _SKIP_RE.match(line):
            continue

        # Check for stage header line
        stage_m = _STAGE_RE.match(line)
        if stage_m:
            # Save previous stage
            if current_stage is not None:
                stages.append(current_stage)

            stage_name = _normalise_stage_name(stage_m.group(1))
            current_stage = {
                "stage_name": stage_name,
                "tasks": int(stage_m.group(2)),
                "frames": int(stage_m.group(3)),
                "datasets": [],
                "dataset_tasks": {},  # per-site task counts (new format)
            }
            continue

        if current_stage is None:
            continue

        # Try OLD format: "     datasets: 150-936, 320-1163"
        ds_m = _DATASET_RE.match(line)
        if ds_m:
            tokens = _DS_TOKEN_RE.findall(ds_m.group(1))
            current_stage["datasets"].extend(tokens)
            continue

        # Try NEW format: "     150-936 (36 tasks), 320-1163 (13 tasks)"
        new_ds_m = _NEW_DATASET_RE.match(line)
        if new_ds_m:
            tokens = _NEW_DS_TOKEN_RE.findall(line)
            for ds_id, task_count in tokens:
                if ds_id not in current_stage["datasets"]:
                    current_stage["datasets"].append(ds_id)
                current_stage["dataset_tasks"][ds_id] = int(task_count)
            continue

    # Don't forget the last stage
    if current_stage is not None:
        stages.append(current_stage)

    return stages


def _normalise_stage_name(raw: str) -> str:
    """Normalise stage names to consistent casing."""
    mapping = {
        "annotate": "Annotate",
        "review": "Review",
        "protex review": "Protex Review",
    }
    return mapping.get(raw.strip().lower(), raw.strip())

