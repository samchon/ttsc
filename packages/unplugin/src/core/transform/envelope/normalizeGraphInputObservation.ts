import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import { resolveFilesystemPath } from "ttsc/path-identity";

import { graphInputObservationCompatible } from "./graphInputObservationCompatible";

/** Normalize one untrusted predicate proof without filling missing predicates. */
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
