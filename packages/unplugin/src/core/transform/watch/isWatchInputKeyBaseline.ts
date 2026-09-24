import path from "node:path";

import { stableStringify } from "../utils/stableStringify";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import type { TtscWatchInputKeyBaseline } from "./TtscWatchInputKeyBaseline";

/** Validate the complete narrow or broad shape stored in a key baseline. */
export function isWatchInputKeyBaseline(
  baseline: unknown,
): baseline is TtscWatchInputKeyBaseline {
  if (!isPlainRecord(baseline)) return false;
  const keys = Object.keys(baseline).sort();
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
  // A plugin source directory's baseline also carries its state
  // (samchon/ttsc#1487).
  const tree = Object.prototype.hasOwnProperty.call(baseline, "tree");
  if (
    stableStringify(keys) !==
    stableStringify(tree ? [...broad, "tree"].sort() : broad)
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
  const keys = Object.keys(value).sort();
  if (value.ok === false) {
    return stableStringify(keys) === stableStringify(["ok"]);
  }
  return (
    stableStringify(keys) === stableStringify(["ok", "path"]) &&
    typeof value.path === "string" &&
    isAbsoluteFilesystemPath(value.path)
  );
}
