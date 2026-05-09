import { Datapoint, Group } from "./types";

/**
 * A "Disclosure Page" represents one navigable step in the wizard.
 * It corresponds to a top-level VSME disclosure (B1, B2, B3, ..., C9).
 * Each page contains 1+ groups, and each group contains 1+ datapoints.
 */
export type DisclosurePage = {
  /** Disclosure code, e.g. "B1", "B3", "C8". Used as URL slug + sort key. */
  code: string;
  /** Human-readable title without the code prefix. */
  title: string;
  /** "Basic" | "Comprehensive" — derived from the code prefix. */
  module: "Basic" | "Comprehensive";
  /** Group IDs that belong to this disclosure, in stable order. */
  groupIds: string[];
};

/**
 * Build the ordered list of disclosure pages by walking the groups in their
 * existing order and bucketing them by the leading code in their disclosure
 * name (e.g. "B3 — Total Energy Consumption" -> bucket "B3").
 *
 * Returns pages in canonical order: B1, B2, ..., B11, C1, C2, ..., C9.
 */
export function buildDisclosurePages(
  groups: Group[],
  datapoints: Datapoint[]
): DisclosurePage[] {
  const buckets = new Map<string, DisclosurePage>();

  for (const group of groups) {
    const code = parseDisclosureCode(group.disclosure);
    if (!code) continue;

    if (!buckets.has(code)) {
      // The first group's disclosure name often has the cleanest title
      // ("B3 — Total Energy Consumption" -> "Total Energy Consumption").
      // Strip the code prefix; specific group titles may differ but the
      // bucket title is whatever the first group's strip produces.
      const title = stripCodePrefix(group.disclosure, code);
      // Module: B-codes are Basic; C-codes are Comprehensive.
      const module = code.startsWith("C") ? "Comprehensive" : "Basic";
      buckets.set(code, { code, title, module, groupIds: [] });
    }
    buckets.get(code)!.groupIds.push(group.id);
  }

  // Use the *shortest* group title within each bucket as the page title,
  // since that's usually the most generic ("Energy and greenhouse gas emissions"
  // beats "Estimated GHG Emissions (GHG Protocol 2004)").
  for (const bucket of buckets.values()) {
    const candidates = bucket.groupIds
      .map((gid) => groups.find((g) => g.id === gid)?.disclosure ?? "")
      .map((title) => stripCodePrefix(title, bucket.code))
      .filter(Boolean);
    if (candidates.length > 0) {
      bucket.title = candidates.reduce((a, b) => (a.length <= b.length ? a : b));
    }
  }

  // Stable canonical order: B1 < B2 < ... < B11 < C1 < ... < C9
  return Array.from(buckets.values()).sort((a, b) => compareCodes(a.code, b.code));
}

/** Extract the leading code like "B3" or "C10" from a disclosure title. */
function parseDisclosureCode(disclosure: string): string | null {
  const m = disclosure.match(/^([BC]\d+)\b/);
  return m ? m[1] : null;
}

/** Strip "B3 — " or "B3 - " or "B3: " etc. from the start of a title. */
function stripCodePrefix(disclosure: string, code: string): string {
  // Match the code, optional space, optional separator, optional space.
  const re = new RegExp(`^${code}\\s*[—\\-:–]?\\s*`);
  return disclosure.replace(re, "").trim();
}

/** Compare codes in canonical VSME order. */
function compareCodes(a: string, b: string): number {
  const ax = parseCode(a);
  const bx = parseCode(b);
  if (ax.module !== bx.module) return ax.module === "B" ? -1 : 1;
  return ax.num - bx.num;
}

function parseCode(code: string): { module: "B" | "C"; num: number } {
  return { module: code[0] as "B" | "C", num: parseInt(code.slice(1), 10) };
}