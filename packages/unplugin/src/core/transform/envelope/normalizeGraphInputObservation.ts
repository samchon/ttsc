import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import { resolveFilesystemPath } from "ttsc/path-identity";

import { graphInputObservationCompatible } from "./graphInputObservationCompatible";

/**
 * Normalize one untrusted predicate proof without filling missing predicates.
 *
 * Malformed, empty or contradictory records return undefined. Present directory
 * lists are copied, successful read hashes must be lowercase SHA-256 text, and
 * successful realpaths must be absolute in the producer's platform semantics.
 * Unknown fields are ignored; absent supported predicates remain unknown.
 *
 * @evidence contracts/common.md#principled-implementation Own-property checks distinguish an omitted predicate from an explicit result, schema checks establish supported value shapes, and compatibility rejects contradictory normalized states without adding new observations.
 * @evidence contracts/common.md#clear-and-simple-design Parsing produces one detached observation and delegates cross-predicate meaning to graphInputObservationCompatible, keeping host filesystem replay outside this boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protocol hash syntax and absolute-realpath checks validate genuine producer data; neither missing predicates nor malformed evidence receive fabricated values.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain undefined outcomes, copied lists, hash form, platform interpretation and unknown versus absent fields with documentation-skill paragraph and tag separation.
 * @evidence contracts/portability.md#os-neutral-implementation The declared producer platform chooses realpath parsing and resolution, while the host platform is only the default; native case behavior is not inferred or rewritten by this structural parser.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Checks each observation field once and copies the two entry lists once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function normalizeGraphInputObservation(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): ITtscCompilerTransformation.IInputObservation | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const entry = value as Record<string, unknown>;
  const observation: ITtscCompilerTransformation.IInputObservation = {};
  if (Object.prototype.hasOwnProperty.call(entry, "accessibleEntries")) {
    const accessible = entry.accessibleEntries;
    if (
      typeof accessible !== "object" ||
      accessible === null ||
      Array.isArray(accessible)
    ) {
      return undefined;
    }
    const lists = accessible as Record<string, unknown>;
    if (
      !Array.isArray(lists.directories) ||
      !lists.directories.every(
        (name): name is string => typeof name === "string",
      ) ||
      !Array.isArray(lists.files) ||
      !lists.files.every((name): name is string => typeof name === "string")
    ) {
      return undefined;
    }
    observation.accessibleEntries = {
      directories: [...lists.directories],
      files: [...lists.files],
    };
  }
  if (Object.prototype.hasOwnProperty.call(entry, "fileExists")) {
    if (typeof entry.fileExists !== "boolean") return undefined;
    observation.fileExists = entry.fileExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "directoryExists")) {
    if (typeof entry.directoryExists !== "boolean") return undefined;
    observation.directoryExists = entry.directoryExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "stat")) {
    if (
      entry.stat !== "missing" &&
      entry.stat !== "file" &&
      entry.stat !== "directory"
    ) {
      return undefined;
    }
    observation.stat = entry.stat;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "readFile")) {
    const read = entry.readFile;
    if (typeof read !== "object" || read === null || Array.isArray(read)) {
      return undefined;
    }
    const result = read as Record<string, unknown>;
    if (result.ok === false && result.hash === undefined) {
      observation.readFile = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.hash === "string" &&
      /^[0-9a-f]{64}$/.test(result.hash)
    ) {
      observation.readFile = { hash: result.hash, ok: true };
    } else {
      return undefined;
    }
  }
  if (Object.prototype.hasOwnProperty.call(entry, "realpath")) {
    const realpath = entry.realpath;
    if (
      typeof realpath !== "object" ||
      realpath === null ||
      Array.isArray(realpath)
    ) {
      return undefined;
    }
    const result = realpath as Record<string, unknown>;
    if (result.ok === false && result.path === undefined) {
      observation.realpath = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.path === "string" &&
      (platform === "win32" ? path.win32 : path.posix).isAbsolute(result.path)
    ) {
      observation.realpath = {
        ok: true,
        path: resolveFilesystemPath(result.path, platform),
      };
    } else {
      return undefined;
    }
  }
  return Object.keys(observation).length !== 0 &&
    graphInputObservationCompatible(observation)
    ? observation
    : undefined;
}
