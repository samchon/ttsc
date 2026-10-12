import { projectRecordFile } from "../../bridge/projectRecordFile";
import { readProjectRecordFile } from "../../bridge/readProjectRecordFile";
import type { TtscTransformHooks } from "./TtscTransformHooks";

/**
 * The dependency-only paths the project record of `tsconfig` carries
 * (`TtscProjectRecord.dependencies`), for a transform cache that has no witness
 * list of its own yet.
 *
 * A compile learns a plugin-reported dependency path only from its own
 * envelope, and one it had no witness for compiles again
 * (`onlyLearnedCompileFacts`). A transform cache keeps the paths in memory
 * (`TRANSFORM_CACHE_DEPENDENCY_WITNESSES`), so every new cache, a dev-server
 * start or a build process, compiled such a project twice (samchon/ttsc#1743).
 * The record the previous process wrote names them. They only say what to read:
 * the capture still witnesses each path afresh, a path the compile no longer
 * reports costs one read, and one the record does not name is retried as
 * before.
 *
 * @param project The host's record directories, when it keeps records.
 * @param tsconfig The project's tsconfig, as the adapter names it.
 * @returns The record's paths, or `undefined` when no readable record names
 *   any.
 * @evidence contracts/common.md#principled-implementation The record is the host's persisted project state, written from a completed generation; its paths are hints that the capture re-witnesses, never certified state.
 * @evidence contracts/common.md#clear-and-simple-design One reader selects the first readable record of the host's directories, in the order the writer tries them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No witness or digest is taken from the record; an unreadable or absent record supplies nothing.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the doubled first compile, the hint semantics and the absent cases.
 * @evidence contracts/portability.md#os-neutral-implementation Record paths come from the host's own directories through `projectRecordFile`.
 * @evidence contracts/performance.md#efficient-algorithms At most two record reads and JSON parses, only when a cache has no witness list for the key.
 * @evidence contracts/performance.md#reuse-equivalent-work A new process reuses the dependency names the last generation's record holds instead of compiling once to learn them.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned list belongs to the caller; nothing is retained here.
 */
export function recordedDependencyWitnesses(
  project: TtscTransformHooks["project"],
  tsconfig: string,
): readonly string[] | undefined {
  if (project === undefined) return undefined;
  for (const directory of [
    project.toolDirectory,
    ...(project.fallbackToolDirectory === undefined
      ? []
      : [project.fallbackToolDirectory]),
  ]) {
    const record = readProjectRecordFile(
      projectRecordFile(directory, tsconfig),
    );
    if (record !== undefined) return record.dependencies;
  }
  return undefined;
}
