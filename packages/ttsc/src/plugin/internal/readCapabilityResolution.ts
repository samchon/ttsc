import fs from "node:fs";

import { CapabilityResolutionFormat } from "./CapabilityResolutionFormat";
import type { ITtscCapabilityResolutionEntry } from "./ITtscCapabilityResolutionEntry";
import { hashHostInputPaths } from "./load/hashHostInputPaths";
import { realpathHostInputPaths } from "./load/realpathHostInputPaths";
import { pluginSourceStateHolds } from "./source/pluginSourceStateHolds";

/**
 * Read the recorded answer for a project, or `null` when there is none that is
 * still true.
 *
 * Fail-closed by construction: every path that cannot prove the entry — a
 * missing file, a parse failure, a format bump, a moved input, a plugin source
 * or build environment the binary was not keyed on, a binary that is gone —
 * returns `null`, and `null` means "walk the project properly". A cache that
 * guessed here would answer "no plugin declares this capability" for a project
 * that had just configured one, which is a wrong answer indistinguishable from
 * the correct answer for the common case.
 *
 * Proving a plugin source reads the build environment, a `go env` run, once per
 * process (`pluginSourceStateHolds`), which is what a walk that finds the
 * binary costs as well: a hit saves the descriptors' evaluation and discovery,
 * not the environment the binary path stands for.
 */
export function readCapabilityResolution(options: {
  cwd: string;
  tsconfig: string;
  version: string;
  env?: NodeJS.ProcessEnv;
}): ITtscCapabilityResolutionEntry | null {
  const file = CapabilityResolutionFormat.resolutionFile(options);
  if (file === null) return null;
  let entry: ITtscCapabilityResolutionEntry;
  try {
    entry = JSON.parse(
      fs.readFileSync(file, "utf8"),
    ) as ITtscCapabilityResolutionEntry;
  } catch {
    return null;
  }
  if (
    !isEntry(entry) ||
    entry.version !== CapabilityResolutionFormat.formatVersion(options.version)
  )
    return null;
  // An entry recording nothing proves nothing. Discovery always reads at least
  // the project's own manifest, so an empty input set is a malformed entry
  // rather than a project with no inputs.
  if (entry.hostInputs.length === 0) return null;
  if (
    !sameMap(entry.hostInputHashes, hashHostInputPaths(entry.hostInputs)) ||
    !sameMap(entry.hostInputRealpaths, realpathHostInputPaths(entry.hostInputs))
  )
    return null;
  // What each binary path was keyed on, proven by the build's own rule: a
  // module root, linked package, or contributor that moved, or another build
  // environment, names a binary the build would no longer produce, while the
  // old one still exists (samchon/ttsc#1492).
  for (const [directory, state] of Object.entries(entry.pluginSources))
    if (!pluginSourceProven(directory, state)) return null;
  for (const plugin of entry.plugins)
    if (!fs.existsSync(plugin.binary)) return null;
  return entry;
}

/** Whether a plugin source still holds its recorded state; unreadable is no. */
function pluginSourceProven(directory: string, state: string): boolean {
  try {
    return pluginSourceStateHolds(directory, state);
  } catch {
    return false;
  }
}

/** Whether the parsed value has every field the validation reads. */
function isEntry(value: unknown): value is ITtscCapabilityResolutionEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ITtscCapabilityResolutionEntry>;
  return (
    typeof entry.version === "string" &&
    Array.isArray(entry.hostInputs) &&
    entry.hostInputs.every((input) => typeof input === "string") &&
    isRecord(entry.hostInputHashes) &&
    isRecord(entry.hostInputRealpaths) &&
    isRecord(entry.pluginSources) &&
    Object.values(entry.pluginSources).every(
      (state) => typeof state === "string",
    ) &&
    typeof entry.manifest === "string" &&
    (entry.projectContext === null ||
      typeof entry.projectContext === "string") &&
    Array.isArray(entry.plugins) &&
    entry.plugins.every(
      (plugin) =>
        typeof plugin === "object" &&
        plugin !== null &&
        typeof plugin.binary === "string" &&
        isRecord(plugin.capabilities),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether two snapshots describe the same state.
 *
 * Compared both ways: an input that has appeared is as much a change as one
 * that has moved, and a recorded key the fresh snapshot lacks means the two
 * were taken over different input sets.
 */
function sameMap(
  recorded: Record<string, string | null>,
  current: Record<string, string | null>,
): boolean {
  const keys = Object.keys(recorded);
  if (keys.length !== Object.keys(current).length) return false;
  return keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(current, key) &&
      recorded[key] === current[key],
  );
}
