import fs from "node:fs";

import { normalizeGraphInputObservation } from "../transform/envelope/normalizeGraphInputObservation";
import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * Read a project record (`projectRecordFile`) back, or nothing for a file that
 * is absent, unreadable, or not a record: such a file names no project and no
 * signal to continue. A build start moves one that is there, since no proof can
 * run over it (`refreshProjectRecordFiles`), and the next generation's delivery
 * writes it whole.
 *
 * Validate consumed input codecs and membership policy before exposing the
 * parsed record. A JSON object header alone does not establish that observers
 * can safely interpret its nested evidence.
 *
 * @evidence contracts/common.md#principled-implementation Structural guards validate the record, every consumed input codec and membership policy; predicate proof uses the existing producer-schema normalizer rather than inventing missing observations.
 * @evidence contracts/common.md#clear-and-simple-design This disk boundary owns untrusted JSON parsing and small schema predicates; filesystem replay and state-change decisions remain with the existing record consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Null states, arrays masquerading as dictionaries and malformed policy lists cannot become apparently valid evidence that crashes or misdirects a later observer.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain absent or unreadable records, nested validation and the next-delivery replacement policy; private helper comments state each consumed schema boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Native UTF-8 reading observes the host record file; absence, access denial and partial in-place writes all produce unavailable evidence without guessing a platform-specific missing-file cause.
 */
export function readProjectRecordFile(
  file: string,
): TtscProjectRecord | undefined {
  let record: unknown;
  try {
    record = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
  if (!isRecord(record)) return undefined;
  const candidate = record;
  if (
    typeof candidate.tsconfig !== "string" ||
    typeof candidate.root !== "string" ||
    typeof candidate.signal !== "number" ||
    !Number.isFinite(candidate.signal) ||
    !isInputEvidenceMap(candidate.inputs) ||
    !isMembership(candidate.membership)
  ) {
    return undefined;
  }
  return {
    inputs: candidate.inputs,
    membership: candidate.membership,
    root: candidate.root,
    signal: candidate.signal,
    tsconfig: candidate.tsconfig,
  };
}

/** A JSON dictionary, excluding arrays and null. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A complete string list, rather than a list with some readable members. */
function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** The membership fields consumed by root-pattern and exclusion replay. */
function isPolicy(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isStrings(value.excludedDirectories) ||
    !isStrings(value.inputExtensions) ||
    !isStrings(value.sources) ||
    (value.useCaseSensitiveFileNames !== undefined &&
      typeof value.useCaseSensitiveFileNames !== "boolean")
  ) return false;
  const specs = value.rootFileSpecs;
  if (specs !== undefined) {
    if (!isRecord(specs) || !isStrings(specs.files) || !isStrings(specs.include))
      return false;
    const root = specs.root;
    if (root !== undefined &&
      (!isRecord(root) || typeof root.path !== "string" ||
        typeof root.realpath !== "string" ||
        (root.nativepath !== undefined && typeof root.nativepath !== "string")))
      return false;
  }
  const origins = value.directoryExclusionOrigins;
  return origins === undefined ||
    (isRecord(origins) && isStrings(origins.exclude) &&
      (origins.declarationDir === undefined || typeof origins.declarationDir === "string") &&
      (origins.outDir === undefined || typeof origins.outDir === "string") &&
      (origins.useImplicitOutputExclusions === undefined ||
        typeof origins.useImplicitOutputExclusions === "boolean"));
}

/** The optional walk proof paired with its exact replay policy. */
function isMembership(value: unknown): value is TtscProjectRecord["membership"] {
  return value === null ||
    (isRecord(value) && typeof value.digest === "string" &&
      isStrings(value.directories) && isPolicy(value.policy));
}

/** Every state codec the observer and detached record proof consume. */
function isInputState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (value.codec) {
    case "host":
      return typeof value.hash === "string";
    case "graph":
      return typeof value.hash === "string" &&
        (value.realpath === null || typeof value.realpath === "string");
    case "predicates":
      return normalizeGraphInputObservation(value.observation) !== undefined;
    case "tree":
      return typeof value.digest === "string";
    case "membership":
      return isMembership(value);
    default:
      return false;
  }
}

/** Input identity and absence facts together with any captured codec state. */
function isInputEvidence(
  value: unknown,
): value is TtscProjectRecord["inputs"][string] {
  return isRecord(value) && typeof value.identity === "string" &&
    typeof value.missing === "boolean" &&
    (value.unavailable === undefined || value.unavailable === "missing" ||
      value.unavailable === "not-file") &&
    (value.state === undefined || isInputState(value.state));
}

/** All own input entries must be interpretable before any are handed off. */
function isInputEvidenceMap(
  value: unknown,
): value is TtscProjectRecord["inputs"] {
  return isRecord(value) && Object.values(value).every(isInputEvidence);
}
