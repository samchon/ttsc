import fs from "node:fs";
import path from "node:path";

import { RuntimeEmitProvenance } from "./RuntimeEmitProvenance";
import { RuntimeProjectMarker } from "./RuntimeProjectMarker";

/**
 * Publish one run's manifest before launching its reader. A managed run must
 * still qualify and already exist. Exclusive creation preserves existing leaf
 * files and does not follow a symbolic link or write a shared inode. Managed
 * manifests carry byte observations for proved compiler-emitted markers.
 *
 * @evidence contracts/common.md#principled-implementation Current native run qualification precedes an exclusive manifest creation. Explicit storage uses its caller-owned directory and existing replacement behavior.
 * @evidence contracts/common.md#clear-and-simple-design Both manifest producers delegate only the native write and keep their own refusal policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Managed publication neither recreates a missing run nor truncates an existing leaf.
 * @evidence contracts/common.md#meaningful-documentation Describes publication ordering and what exclusive creation proves.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat and exclusive open operate on host paths. The caller's directory qualification observes the namespace, without holding directory handles.
 * @evidence contracts/performance.md#efficient-algorithms One serialization and native write follow manifest size. Managed publication additionally checks paths and reads the bytes of proved marker pairs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Publication is an effect.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The write closes its file before launch. A failed write can leave an incomplete manifest for run cleanup.
 */
export function writeRuntimeManifest(
  file: string,
  manifest: object,
  canChange?: (directory: string) => boolean,
): void {
  const run = path.dirname(file);
  if (canChange === undefined) {
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(manifest), "utf8");
    return;
  }
  if (!canChange(run) || !fs.lstatSync(run).isDirectory())
    throw new Error(`ttsx: unsafe system runtime manifest directory: ${run}`);
  const emittedProjectMarkers =
    "emitDir" in manifest &&
    typeof manifest.emitDir === "string" &&
    "emittedSources" in manifest &&
    RuntimeEmitProvenance.isRecord(manifest.emittedSources)
      ? RuntimeProjectMarker.capture(manifest.emitDir, manifest.emittedSources)
      : undefined;
  fs.writeFileSync(
    file,
    JSON.stringify({ ...manifest, emittedProjectMarkers }),
    {
      encoding: "utf8",
      flag: "wx",
    },
  );
}
