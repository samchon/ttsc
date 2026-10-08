import path from "node:path";

import { stableStringify } from "../utils/stableStringify";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import type { TtscWatchInputKeyBaseline } from "./TtscWatchInputKeyBaseline";

/**
 * Validate the complete narrow or broad shape stored in a key baseline.
 *
 * This validates serialized plain objects, not the current filesystem state.
 *
 * @evidence contracts/common.md#principled-implementation Exact key sets, discriminant shapes, SHA-256 syntax and mutually consistent stat predicates validate serialized narrow or broad baselines without treating structural resemblance as content proof.
 * @evidence contracts/common.md#clear-and-simple-design Small private guards separate plain-object, hash and realpath validation while this function owns the complete allowed shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported missing and directory markers are explicit codec constants; extra keys and inconsistent availability are rejected rather than tolerated for a known consumer.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the persisted-key trust boundary and validation scope, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Both POSIX and Windows absolute path syntaxes are accepted for serialized identity payloads without assuming the current machine's OS establishes filesystem identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms Enumerating K supplied keys across the outer and nested records rejects unsupported counts before sorting each fixed-size group (at most eleven outer keys and four native kinds). Comparisons and serialization still process the supplied key text, including long invalid names. Remaining work scales with path/hash text and total listing-name UTF-8 bytes, including byte-prefix order comparisons. Temporary space holds O(K) key references, serialized key text and at most two adjacent encoded names. No native observation or whole-project walk is performed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A structural validation of one value; nothing is shared.
 */
export function isWatchInputKeyBaseline(
  baseline: unknown,
): baseline is TtscWatchInputKeyBaseline {
  if (!isPlainRecord(baseline)) return false;
  const keys = Object.keys(baseline);
  if (keys.length !== 2 && (keys.length < 8 || keys.length > 11)) {
    return false;
  }
  keys.sort();
  if (
    typeof baseline.fileExists !== "boolean" ||
    typeof baseline.identity !== "string" ||
    !isAbsoluteFilesystemPath(baseline.identity)
  ) {
    return false;
  }
  if (stableStringify(keys) === stableStringify(["fileExists", "identity"])) {
    return true;
  }
  const broad = [
    "directoryExists",
    "fileExists",
    "graphHash",
    "graphReadHash",
    "hostHash",
    "identity",
    "realpath",
    "stat",
  ];
  // Optional facts must have their full recorded shape; older baselines can
  // still serve comparisons that do not require these observations.
  const tree = Object.prototype.hasOwnProperty.call(baseline, "tree");
  const accessibleEntries = Object.prototype.hasOwnProperty.call(
    baseline,
    "accessibleEntries",
  );
  const nativePredicates = Object.prototype.hasOwnProperty.call(
    baseline,
    "nativePredicates",
  );
  const expected = [
    ...broad,
    ...(tree ? ["tree"] : []),
    ...(accessibleEntries ? ["accessibleEntries"] : []),
    ...(nativePredicates ? ["nativePredicates"] : []),
  ].sort();
  if (
    stableStringify(keys) !== stableStringify(expected) ||
    (accessibleEntries &&
      !isAccessibleEntriesBaseline(baseline.accessibleEntries)) ||
    (nativePredicates && !isNativePredicateBaselines(baseline.nativePredicates))
  ) {
    return false;
  }
  if (
    tree &&
    baseline.tree !== null &&
    !(typeof baseline.tree === "string" && isContentHash(baseline.tree))
  ) {
    return false;
  }
  if (
    typeof baseline.directoryExists !== "boolean" ||
    !isWatchInputStateHash(baseline.graphHash) ||
    !(
      baseline.graphReadHash === null || isContentHash(baseline.graphReadHash)
    ) ||
    !isWatchInputStateHash(baseline.hostHash) ||
    !isWatchInputRealpathBaseline(baseline.realpath) ||
    (baseline.stat !== "directory" &&
      baseline.stat !== "file" &&
      baseline.stat !== "missing")
  ) {
    return false;
  }
  return (
    baseline.fileExists === (baseline.stat === "file") &&
    baseline.directoryExists === (baseline.stat === "directory")
  );
}

/** Validate exact supported native codec facts without accepting extra fields. */
function isNativePredicateBaselines(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.length > 4) return false;
  for (const key of keys) {
    if (!["file", "optional-file", "entry", "directory"].includes(key)) {
      return false;
    }
    const state = value[key];
    if (
      !isPlainRecord(state) ||
      stableStringify(Object.keys(state).sort()) !==
        stableStringify(["digest", "realpath"]) ||
      !isContentHash(state.digest) ||
      !(state.realpath === null ||
        (typeof state.realpath === "string" &&
          isAbsoluteFilesystemPath(state.realpath)))
    ) {
      return false;
    }
  }
  return true;
}

/** Validate exact sorted entry groups emitted by the compiler listing owner. */
function isAccessibleEntriesBaseline(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    stableStringify(keys.sort()) !== stableStringify(["directories", "files"])
  ) {
    return false;
  }
  for (const names of [value.directories, value.files]) {
    if (!Array.isArray(names)) return false;
    let previous: Buffer | undefined;
    for (const name of names) {
      if (typeof name !== "string" || name.length === 0) return false;
      const encoded = Buffer.from(name, "utf8");
      if (previous !== undefined && Buffer.compare(previous, encoded) > 0) {
        return false;
      }
      previous = encoded;
    }
  }
  return true;
}

/** Whether an unknown value is one ordinary JSON object. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Whether one identity can name an absolute path on either supported syntax. */
function isAbsoluteFilesystemPath(value: string): boolean {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

/** Whether a serialized hash is a content digest. */
function isContentHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** Whether a baseline state is either a digest or the missing marker. */
function isWatchInputStateHash(value: unknown): value is string {
  return value === MISSING_INPUT_STATE || isContentHash(value);
}

/** Validate the serialized Realpath predicate as an exact discriminated union. */
function isWatchInputRealpathBaseline(
  value: unknown,
): value is TtscWatchInputBaseline["realpath"] {
  if (!isPlainRecord(value) || typeof value.ok !== "boolean") return false;
  const keys = Object.keys(value);
  if (keys.length !== (value.ok ? 2 : 1)) return false;
  keys.sort();
  if (value.ok === false) {
    return stableStringify(keys) === stableStringify(["ok"]);
  }
  return (
    stableStringify(keys) === stableStringify(["ok", "path"]) &&
    typeof value.path === "string" &&
    isAbsoluteFilesystemPath(value.path)
  );
}
