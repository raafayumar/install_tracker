/**
 * Slack message parser — extracts partner annotation data from daily status messages.
 *
 * INPUT:  Raw text from Slack (pasted by user in /admin page)
 * OUTPUT: ParsedBlock[] — one block per partner, each containing stages + datasets
 *
 * HOW TO MODIFY:
 * - To add a new stage name (e.g., "QA Review"), add it to:
 *   1. STAGE_RE regex below (the capture group)
 *   2. normaliseStage() mapping at the bottom
 *   3. StageName type in types/index.ts
 *   4. STAGE_COLORS in lib/utils.ts
 *
 * - To change how pipeline type is determined (OB vs PPE), edit determinePipelineType().
 *   Currently: partner name contains "-ppe" → PPE, otherwise → OB.
 *
 * - To support a new Slack format, add a new regex + handler in extractStages().
 */

import { ParsedBlock, ParsedStage, StageName, PipelineType } from "@/types";

// ── Public API ──────────────────────────────────────────────────────────────

export function parseSlackMessage(rawText: string): ParsedBlock[] {
  const blocks = splitBlocks(rawText);
  const results: ParsedBlock[] = [];

  for (const block of blocks) {
    const parsed = parsePartnerBlock(block);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

// ── Internal helpers ────────────────────────────────────────────────────────

const SEPARATOR_RE = /^-{4,}\s*$/m;
const PARTNER_RE = /^([A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)*)\s*$/;
const STAGE_RE = /^\s*(Annotate|Review|Protex\s+Review)\s*:\s*(\d+)\s+tasks?\s*\((\d+)\s+frames?\)/i;
const DATASET_RE = /^\s*datasets?\s*:\s*(.+)$/i;
const NEW_DATASET_RE = /^\s+(\d+-\d+)\s+\(\d+\s+tasks?\)/i;
const NEW_DS_TOKEN_RE = /(\d+-\d+)\s+\((\d+)\s+tasks?\)/g;
const DS_TOKEN_RE = /(\d+-\d+)/g;
const SKIP_RE = /^\s*(Total tasks to annotate|Annotation task lifetime|•\s)/i;

function splitBlocks(text: string): string[] {
  return text.split(SEPARATOR_RE).map((p) => p.trim()).filter(Boolean);
}

function determinePipelineType(partner: string): PipelineType {
  return partner.toLowerCase().includes("-ppe") ? "PPE" : "OB";
}

function parsePartnerBlock(block: string): ParsedBlock | null {
  const lines = block.split("\n");
  if (lines.length === 0) return null;

  // Find first non-empty line
  let firstNonEmpty = "";
  for (const ln of lines) {
    const stripped = ln.trim();
    if (stripped) {
      firstNonEmpty = stripped;
      break;
    }
  }

  // Skip summary / info blocks
  const lower = firstNonEmpty.toLowerCase();
  if (
    lower.startsWith("summary") ||
    lower.includes("is working on") ||
    lower.startsWith("to annotate") ||
    lower.startsWith("annotation task lifetime") ||
    lower.startsWith("current annotation") ||
    lower.startsWith("includes datasets")
  ) {
    return null;
  }

  const partnerMatch = PARTNER_RE.exec(firstNonEmpty);
  if (!partnerMatch) return null;

  const partner = partnerMatch[1];
  const pipelineType = determinePipelineType(partner);

  // Find the index of the partner line
  const partnerLineIdx = lines.findIndex((l) => l.trim() === firstNonEmpty);
  const stages = extractStages(lines.slice(partnerLineIdx + 1));

  if (stages.length === 0) return null;

  return { partner, pipeline_type: pipelineType, stages };
}

function extractStages(lines: string[]): ParsedStage[] {
  const stages: ParsedStage[] = [];
  let currentStage: ParsedStage | null = null;

  for (const line of lines) {
    if (SKIP_RE.test(line)) continue;

    const stageM = STAGE_RE.exec(line);
    if (stageM) {
      if (currentStage !== null) stages.push(currentStage);

      currentStage = {
        stage_name: normaliseStage(stageM[1]),
        tasks: parseInt(stageM[2]),
        frames: parseInt(stageM[3]),
        datasets: [],
        dataset_tasks: {},
      };
      continue;
    }

    if (currentStage === null) continue;

    // Old format: "     datasets: 150-936, 320-1163"
    const dsM = DATASET_RE.exec(line);
    if (dsM) {
      const tokens = [...dsM[1].matchAll(DS_TOKEN_RE)].map((m) => m[1]);
      currentStage.datasets.push(...tokens);
      continue;
    }

    // New format: "     150-936 (36 tasks)"
    const newDsM = NEW_DATASET_RE.exec(line);
    if (newDsM) {
      const tokenRe = new RegExp(NEW_DS_TOKEN_RE.source, "g");
      for (const match of line.matchAll(tokenRe)) {
        const dsId = match[1];
        const taskCount = parseInt(match[2]);
        if (!currentStage.datasets.includes(dsId)) {
          currentStage.datasets.push(dsId);
        }
        currentStage.dataset_tasks[dsId] = taskCount;
      }
      continue;
    }
  }

  if (currentStage !== null) stages.push(currentStage);
  return stages;
}

function normaliseStage(raw: string): StageName {
  const mapping: Record<string, StageName> = {
    annotate: "Annotate",
    review: "Review",
    "protex review": "Protex Review",
  };
  return mapping[raw.trim().toLowerCase()] || (raw.trim() as StageName);
}
