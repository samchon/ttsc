import fs from "node:fs";
import path from "node:path";

import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import { PluginPackageResolution } from "./PluginPackageResolution";

/**
 * Validate contributor records before native host compilation.
 *
 * The source preflight requires an immediate regular filename ending in .go but
 * not _test.go. It does not parse package syntax, build constraints or platform
 * suffixes; actual Go compilation owns buildability.
 *
 * @evidence contracts/common.md#principled-implementation Ordered record checks establish unique accepted names, absolute observed source directories and a regular non-test .go filename before best-effort physical normalization. These checks do not certify Go package buildability or freeze filesystem identity.
 * @evidence contracts/common.md#clear-and-simple-design One traversal owns contributor admission; a private directory predicate isolates regular non-test filename discovery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual loader now calls this unchanged guard; unit callers do not replace contributor compilation or transport assertions.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes filename preflight from actual buildability; returned source strings use best-effort native realpath and can retain original spelling on failure.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native path.isAbsolute, fs.stat, readdir and resolveRealPath preserve platform path and physical-source distinctions rather than using POSIX string heuristics.
 * @evidence contracts/performance.md#efficient-algorithms Each contributor is checked with indexed seen-name membership and one direct directory listing, without recursive payload scans. Name regex/hash and path/entry text, native existence/stat/realpath operations and complete immediate-entry materialization contribute cost; record count alone does not bound that work.
 * @evidence contracts/performance.md#reuse-equivalent-work Within one request the seen-name set avoids repeated name searches; filesystem admission is reobserved because callers may mutate contributor source between requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Name sets and directory listings are invocation-local; returned ordered records transfer to the caller. Their bytes grow with accepted records and names/paths, while a listing materializes all immediate entries; no population ceiling or historical cache is owned here and synchronous filesystem APIs retain no open handle.
 */
export function validatePluginContributors(
  plugin: ITtscPlugin,
): readonly { name: string; source: string }[] | undefined {
  const contributors = plugin.contributors;
  if (contributors === undefined) return undefined;
  if (!Array.isArray(contributors)) {
    throw new Error(
      `ttsc: plugin "${plugin.name}" "contributors" must be an array of { name, source } entries`,
    );
  }
  if (contributors.length === 0) return undefined;
  const seen = new Set<string>();
  const out: { name: string; source: string }[] = [];
  for (const [index, entry] of contributors.entries()) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}] must be an object`,
      );
    }
    const { name, source } = entry as { name?: unknown; source?: unknown };
    if (typeof name !== "string" || !CONTRIBUTOR_NAME_PATTERN.test(name)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].name must match /^[a-z][a-z0-9_]*$/; ` +
          `got ${JSON.stringify(name)}`,
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}] duplicate name ${JSON.stringify(name)}`,
      );
    }
    seen.add(name);
    if (typeof source !== "string" || source.length === 0) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be a non-empty string`,
      );
    }
    if (!path.isAbsolute(source)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be an absolute path; ` +
          `got ${JSON.stringify(source)}`,
      );
    }
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be an existing directory: ${source}`,
      );
    }
    // Reject a directory lacking a regular non-test Go filename before
    // native host compilation can attribute a failure to scratch paths.
    // Filename admission does not certify package syntax or build constraints.
    if (!hasBuildableGoSource(source)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must contain at least one non-test ".go" file: ${source}`,
      );
    }
    out.push({ name, source: PluginPackageResolution.resolveRealPath(source) });
  }
  return out;
}

const CONTRIBUTOR_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function hasBuildableGoSource(dir: string): boolean {
  // This immediate filename preflight is narrower than actual Go admission.
  // Ignored filename prefixes, build constraints and syntax remain compiler-owned.
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".go") &&
      !entry.name.endsWith("_test.go"),
  );
}
