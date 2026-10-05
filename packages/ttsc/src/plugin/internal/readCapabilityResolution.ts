import fs from "node:fs";

import { CapabilityResolutionFormat } from "./CapabilityResolutionFormat";
import type { ITtscCapabilityPluginSource } from "./ITtscCapabilityPluginSource";
import type { ITtscCapabilityResolutionEntry } from "./ITtscCapabilityResolutionEntry";
import { hashHostInputPaths } from "./load/hashHostInputPaths";
import { realpathHostInputPaths } from "./load/realpathHostInputPaths";
import { pluginSourceFilesSignature } from "./source/pluginSourceFilesSignature";
import { pluginSourceStateHolds } from "./source/pluginSourceStateHolds";
import { recordCacheFileUse } from "./source/recordCacheFileUse";

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
 * Proving a plugin source consults the process's environment observation;
 * `pluginSourceStateHolds` refreshes that observation on mismatch. A hit avoids
 * descriptor evaluation/discovery but still checks source/build state. Source
 * bytes can be skipped only when a recorded digest, matching signature and
 * fresh separability evidence are available; unavailable evidence also causes a
 * content read, even without a known metadata change. These sequential checks
 * rely on producer declarations and native metadata semantics. Binary presence
 * is checked with existsSync, not a binary content hash or an
 * executable-lifetime claim.
 *
 * @evidence contracts/common.md#principled-implementation Shape/version, both host-input snapshots, every plugin source's build state and binary presence must all hold before returning the recorded answer; any unproved premise yields null for real project discovery.
 * @evidence contracts/common.md#clear-and-simple-design One reader owns entry acceptance while shared format, source-build proof and input-observation helpers own their distinct identities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An old executable's existence alone cannot prove current plugin behavior; malformed, raced or incompatible inputs cause normal discovery rather than guessed negative capability answers.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains fail-closed absence and which work a hit avoids versus still proves; private helpers explain metadata and bidirectional comparison premises, following the documentation skill's paragraph/tag separation.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs and shared path/realpath observers preserve input spelling/physical projections and query binary presence. Metadata acceleration requires matching device-clock witnesses without inferring precision or case from an OS name; binary contents are not independently identified here.
 * @evidence contracts/performance.md#efficient-algorithms Full entry read/JSON/shape/map checks, host file hashes and realpaths precede source population/signature walks and binary presence queries. Signature reuse avoids source-content reads only under recorded digest/separation premises; other cases hash content, and mismatched state can refresh build environment. Delegated authority/root/executable observation, probe operations and path/key/numeric/record/file bytes contribute native work and transient storage.
 * @evidence contracts/performance.md#reuse-equivalent-work One project/version entry can answer every capability while its recorded hash/physical/source-build projections pass the sequential checks. Metadata acceleration assumes native write/stamp semantics and producer completeness; unavailable observations refuse reuse, without claiming atomic or complete-world identity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Parsed entry data transfers to the caller. Usage refresh and transient clock-probe removal are attempted by their owners and can skip/fail; default pruning has its own interval/protection/failure policy, while explicit roots remain caller-owned. This reader imposes no entry/input/output byte ceiling.
 */
export function readCapabilityResolution(options: {
  /** Invocation directory included in the shared cache-entry identity. */
  cwd: string;

  /** Selected project config identity, as supplied to capability discovery. */
  tsconfig: string;

  /** Ttsc product version, paired with the cache format revision. */
  version: string;

  /** Environment selecting the cache root; ambient process env when omitted. */
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
  // old one still exists.
  const sources = Object.entries(entry.pluginSources);
  const evidence = sources.some(([, source]) => source.signature !== undefined)
    ? CapabilityResolutionFormat.sourceEvidence(
        CapabilityResolutionFormat.clockReference(file),
      )
    : undefined;
  for (const [directory, source] of sources)
    if (!pluginSourceProven(directory, source, evidence)) return null;
  for (const plugin of entry.plugins)
    if (!fs.existsSync(plugin.binary)) return null;
  recordCacheFileUse(file);
  return entry;
}

/**
 * Whether a plugin source still holds its recorded state; unreadable is no.
 *
 * The recorded digest stands in for reading the files while their metadata
 * signature is the recorded one and every stamp is separable from a reference
 * minted now: after a clock rollback a write can land in a recorded stamp's
 * tick, which only a fresh reference rules out. The build environment is proven
 * either way.
 */
function pluginSourceProven(
  directory: string,
  source: ITtscCapabilityPluginSource,
  evidence:
    | ReturnType<typeof CapabilityResolutionFormat.sourceEvidence>
    | undefined,
): boolean {
  try {
    const now =
      source.signature === undefined || evidence === undefined
        ? undefined
        : pluginSourceFilesSignature(directory, evidence);
    return pluginSourceStateHolds(
      directory,
      source.state,
      now !== undefined &&
        now.separable &&
        now.signature === source.signature &&
        source.digest !== undefined
        ? { sourceDigest: source.digest }
        : {},
    );
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
    Object.values(entry.pluginSources).every(isPluginSource) &&
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
 * Whether a recorded plugin source has a state, and a digest with its signature
 * or neither.
 */
function isPluginSource(value: unknown): value is ITtscCapabilityPluginSource {
  if (!isRecord(value) || typeof value.state !== "string") return false;
  return value.digest === undefined && value.signature === undefined
    ? true
    : typeof value.digest === "string" && typeof value.signature === "string";
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
