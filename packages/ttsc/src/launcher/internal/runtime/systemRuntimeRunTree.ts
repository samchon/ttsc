import fs from "node:fs";
import path from "node:path";

import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { isPathWithin } from "../../../plugin/internal/source/isPathWithin";
import { readPosixDirectoryEntries } from "../../../plugin/internal/source/readPosixDirectoryEntries";
import type { RuntimeManifest } from "./RuntimeManifest";

/**
 * Qualify a complete runtime run before moving or deleting its tree. A project
 * may have appeared below the recorded run. The compiler can also have copied
 * an imported JSON project marker into its own output. Such a marker requires
 * the original emit's provenance and exact current source bytes.
 *
 * @evidence contracts/common.md#principled-implementation The current run guard establishes its native identity and selected roots. Its tree scan refuses unrelated project markers and only exempts compiler-observed copies with matching source and output bytes.
 * @evidence contracts/common.md#clear-and-simple-design One run-tree classification serves cleanup and replacement. Absent runs can still be claimed and explicit storage uses the caller's authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unknown emit, unproved copy, aliased marker or unreadable tree cannot authorize recursive removal.
 * @evidence contracts/common.md#meaningful-documentation Describes why a marker within a legitimate emit can occur and the proof needed for it.
 * @evidence contracts/portability.md#os-neutral-implementation Native directory entries distinguish traversal from links. Absolute emit and source paths use native components.
 * @evidence contracts/performance.md#efficient-algorithms Explicit storage costs no scan. A system mutation walks the run once and only opens provenance and source bytes when it sees a potential emitted marker.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each mutation needs current physical ownership and marker bytes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The traversal and provenance records live only within one check and acquire no retained handles.
 */
export function systemRuntimeRunTree(
  run: string,
  canChange?: (directory: string) => boolean,
  entryManifest?: RuntimeManifest,
): "ordinary" | "emitted-marker" | "protected" {
  if (canChange === undefined) return "ordinary";
  if (!canChange(run)) return "protected";
  try {
    if (fs.lstatSync(run, { throwIfNoEntry: false }) === undefined)
      return "ordinary";
    const pending = [run];
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
          if (
            !entry.isFile() ||
            !matchesEmittedMarker(run, target, entryManifest)
          )
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
  entryManifest?: RuntimeManifest,
): boolean {
  const [area, key, generation] = path.relative(run, output).split(path.sep);
  if (!output.endsWith(".json")) return false;
  const metadata =
    area === "fs"
      ? path.join(run, "runtime-manifest.json")
      : area === "deps" &&
          /^[0-9a-f]{16}$/.test(key ?? "") &&
          /^gen-[0-9a-f]{32}$/.test(generation ?? "")
        ? path.join(run, "deps", key! + ".json")
        : undefined;
  const record =
    area === "fs" && entryManifest !== undefined
      ? entryManifest
      : metadata !== undefined && fs.lstatSync(metadata).isFile()
        ? JSON.parse(fs.readFileSync(metadata, "utf8"))
        : undefined;
  if (record === undefined || record === null) return false;
  if (
    area === "fs"
      ? record.depCacheDir !== path.join(run, "deps") ||
        typeof record.emitDir !== "string" ||
        !path.isAbsolute(record.emitDir) ||
        !isPathWithin(record.emitDir, path.join(run, "fs")) ||
        !isPathWithin(output, record.emitDir)
      : "gen-" + record.generation !== generation
  )
    return false;
  const sources: unknown = record.emittedSources?.[output];
  if (!Array.isArray(sources) || sources.length === 0) return false;
  const bytes = fs.readFileSync(output);
  return sources.some(
    (source: unknown) =>
      typeof source === "string" &&
      path.isAbsolute(source) &&
      path.basename(source) === path.basename(output) &&
      fs.lstatSync(source, { throwIfNoEntry: false })?.isFile() === true &&
      fs.readFileSync(source).equals(bytes),
  );
}
