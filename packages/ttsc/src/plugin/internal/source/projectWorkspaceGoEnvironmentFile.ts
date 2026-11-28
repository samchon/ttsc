import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";
import { GoEnvironmentReading } from "./GoEnvironmentReading";
import { GoToolResolution } from "./GoToolResolution";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { isPathWithin } from "./isPathWithin";

/**
 * Keep an external workspace GOENV observation under a path that survives
 * scratch cleanup. The first external native prefix anchors the remaining
 * spelling, so later links and parent components remain part of the lookup.
 *
 * @evidence contracts/common.md#principled-implementation The observation is moved only if the original and surviving lookups have the same signature; a disagreement refuses authority. Scratch-owned settings stay with their source and scratch owner.
 * @evidence contracts/common.md#clear-and-simple-design Reuses the native witness signature and the same cwd addressing as the Go environment reader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not collapse POSIX parent components or substitute a lossy physical spelling.
 * @evidence contracts/common.md#meaningful-documentation Explains the survival boundary and which spelling is kept.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native path identity for the existing prefix and preserves remaining POSIX path bytes, including for missing leaves.
 * @evidence contracts/performance.md#efficient-algorithms An explicit relative setting identifies one key. A relative default selects observed native paths under scratch, with a prefix walk and one metadata comparison per translated key.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The projection uses current scratch metadata for each observation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Updates the caller's proof without retaining a path, descriptor or task.
 */
export function projectWorkspaceGoEnvironmentFile(
  directory: string,
  env: NodeJS.ProcessEnv,
  evidence: PluginBuildEnvironmentWitness.Record,
): PluginBuildEnvironmentWitness.Record {
  if (!GoEnvironmentReading.hasRelativeFile(env)) return evidence;
  const explicit = SidecarEnvironment.read(env, "GOENV");
  const prefix = `${directory}${path.sep}`;
  // Default discovery supplied the path when it recorded the file. Never
  // synthesize Go's default filename from the configuration root here.
  const files = explicit
    ? [GoToolResolution.workingPath(directory, explicit)]
    : [...evidence.keys()].filter((file) => file.startsWith(prefix));
  let projected = evidence;
  for (const file of files) {
    const previous = evidence.get(file);
    if (previous === undefined) continue;
    const surviving = survivingPath(directory, file);
    if (surviving === file) continue;
    if (projected === evidence) projected = new Map(evidence);
    projected.delete(file);
    if (surviving === undefined) continue;
    const current: PluginBuildEnvironmentWitness.Record = new Map();
    PluginBuildEnvironmentWitness.add(current, surviving);
    if (current.get(surviving) === previous)
      PluginBuildEnvironmentWitness.join(projected, current);
    else PluginBuildEnvironmentWitness.refuse(projected, surviving);
  }
  return projected;
}

/** Resolve only the scratch portion of the path and retain the external suffix. */
function survivingPath(scratch: string, file: string): string | undefined {
  const prefix = `${scratch}${path.sep}`;
  if (!file.startsWith(prefix)) return file === scratch ? undefined : file;
  const parts = file.slice(prefix.length).split(path.sep);
  let lookup = scratch;
  for (const [index, part] of parts.entries()) {
    lookup += path.sep + part;
    let physical: string;
    try {
      physical = RuntimeFilesystem.realpathWitness(lookup);
    } catch (error) {
      return RuntimeFilesystem.isMissingPathError(error) ? undefined : file;
    }
    const raw = RuntimeFilesystem.rawRealpath(physical);
    if (
      raw === undefined
        ? isPathWithin(physical, scratch)
        : raw.subarray(0, Buffer.byteLength(prefix)).equals(Buffer.from(prefix))
    )
      continue;
    const suffix = parts.slice(index + 1);
    if (suffix.length === 0) return physical;
    const tail = suffix.join(path.sep);
    return raw === undefined
      ? physical + (physical.endsWith(path.sep) ? "" : path.sep) + tail
      : RuntimeFilesystem.nativePathWitness(
          Buffer.concat([
            raw,
            Buffer.from((raw.at(-1) === 0x2f ? "" : "/") + tail),
          ]),
        );
  }
  return undefined;
}
