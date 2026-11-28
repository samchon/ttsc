import fs from "node:fs";
import path from "node:path";

import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { isPathWithin } from "../../../plugin/internal/source/isPathWithin";
import { readPosixDirectoryEntries } from "../../../plugin/internal/source/readPosixDirectoryEntries";
import { RuntimeFilesystem } from "./RuntimeFilesystem";
import { RuntimeProjectMarker } from "./RuntimeProjectMarker";

interface MarkerRecord {
  depCacheDir?: unknown;
  emitDir?: unknown;
  generation?: unknown;
  emittedSources?: Readonly<Record<string, unknown>>;
  emittedProjectMarkers?: Readonly<Record<string, unknown>>;
}

/**
 * Qualify a complete runtime run before moving or deleting its tree. A project
 * may have appeared below the recorded run. The compiler can also have copied
 * an imported JSON project marker into its own output. Such a marker requires
 * the original emit's provenance and matching current file bytes.
 *
 * @evidence contracts/common.md#principled-implementation The current run guard establishes its native identity and selected roots. Its tree scan refuses unrelated project markers and checks the observed source and output bytes for compiler-owned markers.
 * @evidence contracts/common.md#clear-and-simple-design One run-tree classification serves cleanup and replacement. Absent runs can still be claimed and explicit storage uses the caller's authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unknown emit, unproved copy, aliased marker or unreadable tree cannot authorize recursive removal.
 * @evidence contracts/common.md#meaningful-documentation Describes why a marker within a legitimate emit can occur and the proof needed for it.
 * @evidence contracts/portability.md#os-neutral-implementation Native directory entries distinguish traversal from links. Absolute emit and source paths use native components.
 * @evidence contracts/performance.md#efficient-algorithms Explicit storage costs no scan. A system mutation walks the run once, reads each consulted provenance record once, and compares only the bytes of its actual marker pairs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each mutation needs current physical ownership and marker bytes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The traversal and provenance records live only within one check and acquire no retained handles.
 */
export function systemRuntimeRunTree(
  run: string,
  canChange?: (directory: string) => boolean,
): "ordinary" | "emitted-marker" | "protected" {
  if (canChange === undefined) return "ordinary";
  if (!canChange(run)) return "protected";
  try {
    if (fs.lstatSync(run, { throwIfNoEntry: false }) === undefined)
      return "ordinary";
    const pending = [run];
    const records = new Map<string, MarkerRecord>();
    let emittedMarker = false;
    while (pending.length !== 0) {
      const directory = pending.pop()!;
      const entries =
        process.platform === "win32"
          ? fs.readdirSync(directory, { withFileTypes: true })
          : readPosixDirectoryEntries(directory);
      for (const entry of entries) {
        const name = entry.name.toString();
        if (
          Buffer.isBuffer(entry.name) &&
          !Buffer.from(name).equals(entry.name)
        )
          return "protected";
        const target = path.join(directory, name);
        if (systemTempOutsideProject.isProjectMarker(name)) {
          if (!entry.isFile() || !matchesEmittedMarker(run, target, records))
            return "protected";
          emittedMarker = true;
        }
        if (entry.isDirectory()) pending.push(target);
      }
    }
    return emittedMarker ? "emitted-marker" : "ordinary";
  } catch {
    return "protected";
  }
}

/** Match a current JSON marker against the producer's exact output witness. */
function matchesEmittedMarker(
  run: string,
  output: string,
  records: Map<string, MarkerRecord>,
): boolean {
  if (path.extname(output).toLowerCase() !== ".json") return false;
  const [area, key, generation] = path.relative(run, output).split(path.sep);
  const metadata =
    area === "fs"
      ? path.join(run, "runtime-manifest.json")
      : area === "deps" &&
          /^[0-9a-f]{16}$/.test(key ?? "") &&
          /^gen-[0-9a-f]{32}$/.test(generation ?? "")
        ? path.join(run, "deps", key! + ".json")
        : undefined;
  if (metadata === undefined) return false;
  let record = records.get(metadata);
  if (record === undefined) {
    const entry = fs.lstatSync(metadata);
    if (!entry.isFile() || entry.nlink !== 1) return false;
    const contents = RuntimeFilesystem.readObservedRegularFile(metadata, true);
    if (contents === undefined) return false;
    const parsed: unknown = JSON.parse(contents.toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return false;
    record = parsed;
    records.set(metadata, record);
  }
  if (
    area === "fs"
      ? record.depCacheDir !== path.join(run, "deps") ||
        typeof record.emitDir !== "string" ||
        !path.isAbsolute(record.emitDir) ||
        !isPathWithin(record.emitDir, path.join(run, "fs")) ||
        !isPathWithin(output, record.emitDir)
      : typeof record.generation !== "string" ||
        "gen-" + record.generation !== generation
  )
    return false;
  return RuntimeProjectMarker.matches(
    output,
    record.emittedSources?.[output],
    record.emittedProjectMarkers?.[output],
  );
}
